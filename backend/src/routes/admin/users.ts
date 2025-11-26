import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { HttpError } from "../../utils/httpError.ts";
import {
  adminInviteRequestSchema,
  adminRoleUpdateSchema,
} from "../../../../shared/validation/adminUsersSchema.ts";
import { buildRedirectUrl, getRequiredAuthEnv } from "../../utils/authRedirect.ts";
import { sanitizeRedirectTarget } from "../../utils/authRedirect.ts";
import {
  countProfilesByRole,
  getProfileById,
  listProfilesByRole,
  updateProfileRole,
  upsertProfile,
} from "../../../../data/repositories/profileRepository.ts";
import type { Profile, ProfileRole } from "../../../../data/types.ts";
import {
  createInvite,
  listInvites,
  revokeInvite,
} from "../../../../data/repositories/adminInviteRepository.ts";
import type { AdminInvite } from "../../../../data/types.ts";
import { updateSupabaseAppRole } from "../../services/supabaseUserService.ts";
import { getSupabaseClient } from "../../../../data/supabaseClient.ts";
import { generateInviteToken, hashInviteToken } from "../../utils/inviteTokens.ts";

const router = Router();
const DEFAULT_INVITE_EXPIRY_HOURS = 72;

const supabaseAuthClient = getSupabaseClient({ service: true }) as {
  auth: {
    signInWithOtp: (params: {
      email: string;
      options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
    }) => Promise<{ error: Error | null }>;
  };
};

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [admins, invites] = await Promise.all([
      listProfilesByRole("admin"),
      listInvites(),
    ]);

    res.json({
      data: {
        admins: admins.map(serializeProfile),
        invites: invites.filter(isPendingInvite).map(serializeInvite),
      },
      meta: {
        fetchedAt: new Date().toISOString(),
        adminCount: admins.length,
        pendingInviteCount: invites.filter(isPendingInvite).length,
      },
    });
  })
);

router.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const parsed = adminInviteRequestSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      res.status(422).json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
      return;
    }

    const payload = parsed.data;
    const expiryHours = payload.expiresInHours ?? DEFAULT_INVITE_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
    const inviteToken = generateInviteToken();
    const tokenHash = hashInviteToken(inviteToken);

    try {
      const invite = await createInvite({
        email: payload.email,
        role: payload.role,
        tokenHash,
        expiresAt,
        invitedBy: await resolveInviterProfileId(req.authUser?.id ?? null, req.authUser?.email ?? null, req.authUser?.appRole ?? null),
      });

      const redirectTarget = buildInviteRedirect(inviteToken);
      await sendMagicLink(payload.email, redirectTarget);

      res.status(201).json({
        data: {
          invite: serializeInvite(invite),
          inviteToken,
          redirectTarget,
        },
        meta: {
          expiresAt,
        },
      });
    } catch (error) {
      if (isUniqueInviteError(error)) {
        res.status(409).json({
          error: {
            code: "INVITE_EXISTS",
            message: "Šiam el. paštui jau išsiųstas kvietimas.",
          },
        });
        return;
      }

      throw error;
    }
  })
);

router.patch(
  "/:id/role",
  asyncHandler(async (req, res) => {
    const id = req.params.id?.trim();

    if (!id) {
      res.status(400).json({
        error: {
          code: "PROFILE_ID_REQUIRED",
          message: "Naudotojo ID privalomas.",
        },
      });
      return;
    }

    const parsed = adminRoleUpdateSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      res.status(422).json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
      return;
    }

    const targetRole = parsed.data.role as ProfileRole;
    const profile = await getProfileById(id);

    if (!profile) {
      res.status(404).json({
        error: {
          code: "PROFILE_NOT_FOUND",
          message: "Naudotojas nerastas.",
        },
      });
      return;
    }

    if (profile.role === targetRole) {
      res.json({
        data: {
          profile: serializeProfile(profile),
        },
        meta: {
          changed: false,
        },
      });
      return;
    }

    if (profile.role === "admin" && targetRole !== "admin") {
      const adminCount = await countProfilesByRole("admin");
      if (adminCount <= 1) {
        res.status(409).json({
          error: {
            code: "LAST_ADMIN",
            message: "Negalima nuimti paskutinio administratoriaus teisių.",
          },
        });
        return;
      }
    }

    const previousRole = profile.role;
    const updatedProfile = await updateProfileRole(profile.id, targetRole);

    try {
      await updateSupabaseAppRole(profile.id, targetRole);
    } catch (syncError) {
      await updateProfileRole(profile.id, previousRole);
      throw syncError;
    }

    res.json({
      data: {
        profile: serializeProfile(updatedProfile),
      },
      meta: {
        changed: true,
      },
    });
  })
);

router.delete(
  "/invite/:id",
  asyncHandler(async (req, res) => {
    const idParam = z.string().uuid().safeParse(req.params.id);

    if (!idParam.success) {
      res.status(422).json({
        error: {
          code: "INVALID_INVITE_ID",
          message: "Kvietimo ID neteisingas.",
        },
      });
      return;
    }

    const invite = await revokeInvite(idParam.data);

    res.json({
      data: {
        invite: serializeInvite(invite),
      },
      meta: {
        revokedAt: invite.revokedAt,
      },
    });
  })
);

function serializeProfile(profile: Profile) {
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    callsign: profile.callsign,
    preferredLanguage: profile.preferredLanguage,
    updatedAt: profile.updatedAt,
    createdAt: profile.createdAt,
  };
}

function serializeInvite(invite: AdminInvite) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: getInviteStatus(invite),
    expiresAt: invite.expiresAt,
    invitedBy: invite.invitedBy,
    acceptedProfileId: invite.acceptedProfileId,
    acceptedAt: invite.acceptedAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
  };
}

function getInviteStatus(invite: AdminInvite): "pending" | "accepted" | "revoked" | "expired" {
  if (invite.acceptedAt) {
    return "accepted";
  }

  if (invite.revokedAt) {
    return "revoked";
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return "expired";
  }

  return "pending";
}

function isPendingInvite(invite: AdminInvite): boolean {
  return getInviteStatus(invite) === "pending";
}

async function sendMagicLink(email: string, redirectTarget: string): Promise<void> {
  const sanitized = sanitizeRedirectTarget(redirectTarget) ?? "/";
  const baseRedirectUrl = getRequiredAuthEnv("AUTH_REDIRECT_URL");
  const emailRedirectTo = buildRedirectUrl(baseRedirectUrl, sanitized);
  const { error } = await supabaseAuthClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw new HttpError(502, "Nepavyko išsiųsti kvietimo nuorodos.", "AUTH_MAGIC_LINK_FAILED");
  }
}

function buildInviteRedirect(inviteToken: string): string {
  return `/profilis?invite=${encodeURIComponent(inviteToken)}`;
}

async function resolveInviterProfileId(
  userId: string | null,
  email: string | null,
  appRole: string | null
): Promise<string | null> {
  if (!userId || !email) {
    return null;
  }

  const existing = await getProfileById(userId);
  if (existing) {
    return existing.id;
  }

  try {
    const created = await upsertProfile({
      id: userId,
      email,
      role: appRole === "admin" ? "admin" : undefined,
    });
    return created.id;
  } catch (error) {
    console.warn("[admin/users] Failed to auto-create inviter profile", error);
    return null;
  }
}

function isUniqueInviteError(error: unknown): boolean {
  if (typeof error !== "object" || !error) {
    return false;
  }

  const pgError = error as { message?: string; code?: string; details?: string };
  return (
    pgError.code === "23505" ||
    (typeof pgError.message === "string" &&
      pgError.message.includes("admin_invites_active_email_unique_idx"))
  );
}

export default router;

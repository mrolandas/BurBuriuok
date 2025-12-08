import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { requireUserSession } from "../middleware/requireUserSession.ts";
import { profileUpsertSchema } from "../../../shared/validation/profileSchema.ts";
import {
  getProfileById,
  upsertProfile,
} from "../../../data/repositories/profileRepository.ts";
import { getAppConfig } from "../../../data/repositories/settingsRepository.ts";
import { hashInviteToken } from "../utils/inviteTokens.ts";
import {
  findInviteByTokenHash,
  findPendingInviteByEmail,
  markInviteAccepted,
} from "../../../data/repositories/adminInviteRepository.ts";
import { updateSupabaseAppRole } from "../services/supabaseUserService.ts";
import type { AdminInvite, Profile, UpsertProfileInput } from "../../../data/types.ts";
import { maybeRespondMissingAuthTables } from "../utils/migrationGuards.ts";

const router = Router();
router.use(requireUserSession);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    try {
      const userId = req.authUser!.id;
      const profile = await getProfileById(userId);

      res.json({
        data: {
          profile: profile ? serializeProfile(profile) : null,
        },
        meta: {
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (maybeRespondMissingAuthTables(res, error)) {
        return;
      }
      throw error;
    }
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    try {
      const parsed = profileUpsertSchema.safeParse(req.body ?? {});

      if (!parsed.success) {
        res.status(422).json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
        return;
      }

      const payload = parsed.data;
      const userId = req.authUser!.id;
      const email = req.authUser!.email;

      if (!email) {
        res.status(400).json({
          error: {
            code: "EMAIL_REQUIRED",
            message: "Supabase paskyra neturi el. pašto adreso.",
          },
        });
        return;
      }

      const upsertInput: UpsertProfileInput = {
        id: userId,
        email,
        preferredLanguage: payload.preferredLanguage,
        callsign: typeof payload.callsign === "undefined" ? undefined : payload.callsign,
      };

      let inviteId: string | null = null;

      if (payload.inviteToken) {
        const invite = await findInviteByTokenHash(hashInviteToken(payload.inviteToken));

        if (!invite || getInviteStatus(invite) !== "pending") {
          res.status(404).json({
            error: {
              code: "INVITE_NOT_FOUND",
              message: "Kvietimas nerastas arba negaliojantis.",
            },
          });
          return;
        }

        if (invite.email !== email) {
          res.status(403).json({
            error: {
              code: "INVITE_EMAIL_MISMATCH",
              message: "Kvietimas skirtas kitam el. paštui.",
            },
          });
          return;
        }

        inviteId = invite.id;
        upsertInput.role = invite.role;
      }

      if (!inviteId) {
        const config = await getAppConfig();
        const registrationEnabled = config.registrationEnabled;
        if (!registrationEnabled) {
          const existing = await getProfileById(userId);
          if (!existing) {
            const pendingInvite = await findPendingInviteByEmail(email);
            if (pendingInvite) {
              inviteId = pendingInvite.id;
              upsertInput.role = pendingInvite.role;
            } else {
              res.status(403).json({
                error: {
                  code: "REGISTRATION_DISABLED",
                  message: "Registracija šiuo metu išjungta.",
                },
              });
              return;
            }
          }
        }
      }

      const profile = await upsertProfile(upsertInput);
      await updateSupabaseAppRole(profile.id, profile.role);

      if (inviteId) {
        await markInviteAccepted(inviteId, profile.id);
      }

      res.status(201).json({
        data: {
          profile: serializeProfile(profile),
        },
        meta: {
          createdAt: profile.createdAt,
          inviteAccepted: Boolean(inviteId),
        },
      });
    } catch (error) {
      if (maybeRespondMissingAuthTables(res, error)) {
        return;
      }
      throw error;
    }
  })
);

function serializeProfile(profile: Profile | null) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    preferredLanguage: profile.preferredLanguage,
    callsign: profile.callsign,
    updatedAt: profile.updatedAt,
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

export default router;

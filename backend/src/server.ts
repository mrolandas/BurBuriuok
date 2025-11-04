import app from "./app.ts";

const port = Number.parseInt(
  process.env.BACKEND_PORT ?? process.env.PORT ?? "4000",
  10
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});

export function generateSecret() {
  const array = crypto.getRandomValues(
    new Uint8Array(32)
  );

  return (
    "0x" +
    Array.from(array)
      .map((b) =>
        b.toString(16).padStart(2, "0")
      )
      .join("")
  ) as `0x${string}`;
}
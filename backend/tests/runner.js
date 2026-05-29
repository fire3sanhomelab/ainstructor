export function describe(name, fn) {
  console.log(`\n=== ${name} ===`);
  fn();
}

export async function it(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

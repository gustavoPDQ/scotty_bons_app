/**
 * Server-side performance instrumentation.
 *
 * Wraps async operations and logs timing to the server console.
 * Visible in: `next dev` terminal output, Vercel function logs.
 *
 * Usage:
 *   const { result, ms } = await timeQuery("fetchOrders", () => supabase.from("orders").select("*"));
 *
 * Or wrap a whole page:
 *   const timer = createPageTimer("Dashboard");
 *   const data = await timer.time("fetchOrders", () => ...);
 *   timer.summary();  // logs all timings + total
 */

export async function timeQuery<T>(
  label: string,
  fn: () => PromiseLike<T>,
): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round((performance.now() - start) * 100) / 100;
  return { result, ms };
}

export function createPageTimer(pageName: string) {
  const entries: { label: string; ms: number }[] = [];
  const pageStart = performance.now();

  return {
    async time<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
      const { result, ms } = await timeQuery(label, fn);
      entries.push({ label, ms });
      return result;
    },

    /** Call at the end of the page to log all timings */
    summary() {
      const totalMs =
        Math.round((performance.now() - pageStart) * 100) / 100;
      const lines = entries
        .sort((a, b) => b.ms - a.ms)
        .map((e) => `  ${e.label.padEnd(35)} ${String(e.ms).padStart(8)}ms`);

      console.log(
        `\n⏱  [${pageName}] Total: ${totalMs}ms\n` +
          lines.join("\n") +
          "\n",
      );
    },
  };
}

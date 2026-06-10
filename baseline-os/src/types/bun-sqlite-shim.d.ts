// Minimal type shim for `bun:sqlite` so plain `tsc` (no @types/bun) can compile
// files that import the Bun-provided SQLite driver.
//
// At runtime Bun supplies the real implementation. This shim declares only the
// subset of the API the kanban dispatcher uses; widen as the surface grows.
declare module "bun:sqlite" {
  export interface Statement<TBindings = unknown[]> {
    run(...bindings: TBindings extends unknown[] ? TBindings : never): {
      changes: number
      lastInsertRowid: number | bigint
    }
    get<T = unknown>(
      ...bindings: TBindings extends unknown[] ? TBindings : never
    ): T | undefined
    all<T = unknown>(
      ...bindings: TBindings extends unknown[] ? TBindings : never
    ): T[]
    finalize(): void
  }

  export class Database {
    constructor(filename?: string, options?: { create?: boolean; readonly?: boolean; readwrite?: boolean })
    prepare<TBindings = unknown[]>(sql: string): Statement<TBindings>
    run(sql: string, ...bindings: unknown[]): { changes: number; lastInsertRowid: number | bigint }
    exec(sql: string): void
    transaction<T extends (...args: never[]) => unknown>(fn: T): T
    close(): void
  }

  export default Database
}

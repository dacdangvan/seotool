/**
 * Unit of Work Interface
 * Ensures atomic operations across multiple repositories
 */

export interface IUnitOfWork {
  /**
   * Begin a transaction
   */
  begin(): Promise<void>;

  /**
   * Commit the transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute a function within a transaction
   */
  executeInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

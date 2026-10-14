/**
 * Файл не найден при чтении.
 */
export class FileNotFoundError extends Error {
  /**
   * @param filePath - путь к отсутствующему файлу
   */
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = "FileNotFoundError";
  }
}

/**
 * Содержимое файла — невалидный JSON.
 */
export class InvalidJsonError extends Error {
  /**
   * @param filePath - путь к файлу с битым JSON
   * @param reason - причина от JSON.parse (включает позицию)
   */
  constructor(filePath: string, reason: string) {
    super(`Invalid JSON in ${filePath}: ${reason}`);
    this.name = "InvalidJsonError";
  }
}

/**
 * JSON не прошёл Zod-схему.
 */
export class SchemaValidationError extends Error {
  /** Полный список ошибок Zod. */
  readonly issues: unknown[];

  /**
   * @param filePath - путь к файлу с невалидными данными
   * @param issues - issues из ZodError
   */
  constructor(filePath: string, issues: unknown[]) {
    super(`Schema validation failed for ${filePath}: ${JSON.stringify(issues)}`);
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

/**
 * Попытка выйти за пределы корня хранилища.
 */
export class PathTraversalError extends Error {
  /**
   * @param target - запрошенный путь или slug
   */
  constructor(target: string) {
    super(`Path traversal rejected: ${target}`);
    this.name = "PathTraversalError";
  }
}

/**
 * Workspace с таким slug уже существует.
 */
export class WorkspaceExistsError extends Error {
  /**
   * @param slug - занятый slug
   */
  constructor(slug: string) {
    super(`Workspace already exists: ${slug}`);
    this.name = "WorkspaceExistsError";
  }
}

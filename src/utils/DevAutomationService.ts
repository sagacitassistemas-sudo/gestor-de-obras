import fs from 'fs/promises';
import path from 'path';

class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpen';
  }
}

export class DevAutomationService {
  private static retryCount: number = 0;

  public static sanitizePII(text: string): string {
    if (!text) return text;
    let sanitized = text;

    const jwtRegex = /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+/g;
    sanitized = sanitized.replace(jwtRegex, '[REDACTED_JWT]');

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    sanitized = sanitized.replace(emailRegex, '[REDACTED_EMAIL]');

    const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    sanitized = sanitized.replace(cpfRegex, '[REDACTED_CPF]');

    return sanitized;
  }

  public static async logError(errorTitle: string, rawData: string): Promise<string> {
    const sanitizedData = this.sanitizePII(rawData);
    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = errorTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    const fileName = `${dateStr}_${safeTitle}.md`;
    const folderPath = path.join(process.cwd(), '.ai', 'errors');
    const filePath = path.join(folderPath, fileName);
    
    const markdownContent = `# Post-Mortem: ${errorTitle}\n\n## Date\n${new Date().toISOString()}\n\n## Raw Output\n\`\`\`text\n${sanitizedData}\n\`\`\`\n`;

    try {
      await fs.mkdir(folderPath, { recursive: true });
    } catch (err) {}

    await fs.writeFile(filePath, markdownContent, 'utf-8');

    return `.ai/errors/${fileName}`;
  }

  public static async processLoop(maxRetries: number = 3): Promise<boolean> {
    this.retryCount++;
    if (this.retryCount > maxRetries) {
      throw new CircuitBreakerError('CircuitBreakerOpen: Maximum retry limit reached. Halting AI loop to prevent attention drift.');
    }
    return true;
  }

  public static resetLoop() {
    this.retryCount = 0;
  }
}

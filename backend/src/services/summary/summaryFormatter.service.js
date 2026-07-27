class SummaryFormatterService {
  /**
   * Cleans and formats markdown summary output
   */
  formatSummary(rawText, summaryType = 'quick') {
    if (!rawText) {
      return '### ⚠️ Summary Unavailable\nUnable to generate summary at this time.';
    }

    let cleaned = rawText.trim();
    // Ensure clean line breaks between headings and lists
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned;
  }

  formatFallbackMessage(message) {
    return `### ℹ️ Notice\n${message}`;
  }
}

export default new SummaryFormatterService();

class SummaryPromptService {
  /**
   * Phase 3.2.4: Constructs summary prompts isolated strictly to the active resource (pdf | youtube | notes)
   */
  buildPrompt({ resourceType, resourceData, summaryType, sessionTitle }) {
    const type = (summaryType || 'quick').toLowerCase();
    
    let personaInstruction = 
      'You are MindSync AI Summary Engine, an expert educational synthesizer. ' +
      'Your task is to analyze the provided study resource content and generate a high-quality summary. ' +
      'Strictly avoid hallucinations, do NOT invent information outside the provided text, and NEVER reference inactive resources.';

    let formatInstruction = '';
    switch (type) {
      case 'quick':
        formatInstruction = 'Provide a Quick Summary formatted as 5 to 10 concise, high-impact bullet points under the heading "### ⚡ Quick Summary".';
        break;
      case 'detailed':
        formatInstruction = 'Provide a Detailed Summary with clear section headings (##), sub-headings (###), core concepts, detailed explanations, and bullet points under "## 📄 Detailed Summary".';
        break;
      case 'key-takeaways':
        formatInstruction = 'Provide Key Takeaways focusing on critical action items, main formulas, theorems, or takeaways under "### 🔑 Key Takeaways".';
        break;
      case 'beginner':
        formatInstruction = 'Explain the topic in simple, beginner-friendly language using everyday analogies under "### 💡 Simple Explanation".';
        break;
      default:
        formatInstruction = 'Provide a clear, structured summary with bullet points under "### ⚡ Summary".';
    }

    let resourceContext = '';

    if (resourceType === 'pdf') {
      resourceContext += `[RESOURCE TYPE: PDF DOCUMENT]\n`;
      resourceContext += `Document Title: ${resourceData.filename || sessionTitle || 'Educational PDF'}\n`;
      if (resourceData.pageCount) resourceContext += `Total Pages: ${resourceData.pageCount}\n`;
      if (resourceData.extractedText && resourceData.extractedText.trim()) {
        resourceContext += `Extracted Content:\n${resourceData.extractedText.slice(0, 8000)}\n`;
      } else {
        return { isUnavailable: true, message: "I can see that a PDF is open, but its contents haven't been processed yet." };
      }
    } else if (resourceType === 'youtube') {
      resourceContext += `[RESOURCE TYPE: YOUTUBE VIDEO]\n`;
      resourceContext += `Video Title: ${resourceData.title || sessionTitle || 'Educational Video'}\n`;
      if (resourceData.url) resourceContext += `Video URL: ${resourceData.url}\n`;
      if (resourceData.transcript && resourceData.transcript.trim()) {
        resourceContext += `Transcript Content:\n${resourceData.transcript.slice(0, 8000)}\n`;
      } else {
        return { isUnavailable: true, message: "I can see the video, but no transcript is available yet." };
      }
    } else if (resourceType === 'notes') {
      resourceContext += `[RESOURCE TYPE: WORKSHOP NOTES]\n`;
      resourceContext += `Note Title: ${resourceData.title || 'Untitled Note'}\n`;
      if (resourceData.content && resourceData.content.trim()) {
        resourceContext += `Note Content:\n${resourceData.content.slice(0, 8000)}\n`;
      } else {
        return { isUnavailable: true, message: "This note is empty. Add some content to generate a summary." };
      }
    }

    const systemInstruction = `${personaInstruction}\n\n${resourceContext}\n\n${formatInstruction}`;
    const userMessage = `Please generate a ${type.toUpperCase()} summary for this ${resourceType.toUpperCase()} resource.`;

    return {
      isUnavailable: false,
      systemInstruction,
      messages: [{ role: 'user', content: userMessage }]
    };
  }
}

export default new SummaryPromptService();

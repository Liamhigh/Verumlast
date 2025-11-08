
export interface FileData {
  name: string;
  type: string;
  base64: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  fileNames?: string[]; // For user message display
  filesForSealing?: FileData[]; // For model message to hold data for sealing
  isSealed?: boolean;
  manifest?: Record<string, any>;
  signature?: string; // base64
  pdfHash?: string;
}

export interface FilePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface ForensicReport {
  conversationId: string;
  overallTruthDensity: number;
  deceptionHotZones: {
    topic: string;
    severity: number;
  }[];
  participantAnalysis: {
    [key: string]: {
      truthDensity: number;
    };
  };
  constitutionalCompliance: {
    threeSourceVerification: boolean;
    deterministicOutput: boolean;
  };
  summary: string;
  actionableOutput: {
    rank: number;
    liability: string;
    severity: string;
  }[];
}

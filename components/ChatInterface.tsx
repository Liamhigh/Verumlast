import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, Part } from '@google/genai';
import { jsPDF } from 'jspdf';
import { Message, FileData } from '../types';
import { CONSTITUTION_PROMPT, PaperclipIcon, SendIcon, XCircleIcon, SealIcon, CloudArrowUpIcon, AlertTriangleIcon } from '../constants';
import ReactMarkdown from 'react-markdown';

// --- Crypto & Utility Helpers ---
const fileDataToBuffer = (file: FileData) => Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
const bufferToHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
const bufferToBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

const hashData = async (data: ArrayBuffer | string): Promise<string> => {
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
    return bufferToHex(hashBuffer);
};

const generateKeyPair = () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const exportPublicKeyAsPem = async (publicKey: CryptoKey) => {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    const base64 = bufferToBase64(exported);
    return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
};
const signData = (privateKey: CryptoKey, data: string) => {
    const buffer = new TextEncoder().encode(data);
    return crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, privateKey, buffer);
};

// --- PDF Generation ---
const generateSealedPdf = async (
    reportContent: string, 
    files: FileData[], 
    manifest: Record<string, any>,
    signature: string // base64
): Promise<{pdfBlob: Blob, pdfHash: string}> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // --- Main Report Pages ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Verum Omnis: Forensic Analysis', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const splitText = doc.splitTextToSize(reportContent, pageWidth - margin * 2);
    splitText.forEach((line: string) => {
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 7;
    });

    // --- Certification Page ---
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Certification of Analysis', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // QR Code
    const qrPayload = JSON.stringify({ manifest_id: manifest.manifest_id, sha512_pdf: "[VERIFY EXTERNALLY]", device_fp: manifest.device_id_fingerprint });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrPayload)}`;
    const qrImage = await fetch(qrUrl).then(res => res.blob());
    const qrReader = new FileReader();
    const qrDataUrl = await new Promise<string>(resolve => {
        qrReader.onload = (e) => resolve(e.target?.result as string);
        qrReader.readAsDataURL(qrImage);
    });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 40, yPosition, 40, 40);
    
    // Manifest Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Document Manifest', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    
    const manifestLines = [
        `Manifest ID: ${manifest.manifest_id}`,
        `Sealed Timestamp (UTC): ${manifest.sealed_timestamp_utc}`,
        `Verum Omnis Version: ${manifest.version}`,
        `Geolocation: ${manifest.geolocation === 'not available' ? 'Not available' : `${manifest.geolocation.latitude.toFixed(4)}, ${manifest.geolocation.longitude.toFixed(4)}`}`
    ];
    doc.text(manifestLines, margin, yPosition);
    yPosition += manifestLines.length * 4 + 4;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Evidence Files', margin, yPosition);
    yPosition += 5;
    doc.setFont('courier', 'normal');
    manifest.evidence_files.forEach((f: any) => {
         const fileLines = doc.splitTextToSize(`- ${f.file_name} (SHA-512: ${f.sha512_original})`, pageWidth - margin * 2 - 5);
         doc.text(fileLines, margin + 5, yPosition);
         yPosition += fileLines.length * 3.5;
    });
    yPosition += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Cryptographic Seals', margin, yPosition);
    yPosition += 5;
    doc.setFont('courier', 'normal');
    const cryptoLines = [
        `Device Public Key (fingerprint): ${manifest.device_id_fingerprint}`,
        `ECDSA Signature (base64):`
    ];
    doc.text(cryptoLines, margin, yPosition);
    yPosition += cryptoLines.length * 4;
    const sigLines = doc.splitTextToSize(signature, pageWidth - margin * 2);
    doc.text(sigLines, margin, yPosition);
    yPosition += sigLines.length * 3.5 + 8;
    
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text("The SHA-512 hash of this PDF can be computed and verified externally against the records provided during online review.", margin, yPosition);
    
    // Add footers
    const pageCount = doc.internal.getNumberOfPages();
    const now = new Date();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Use an unambiguous, locale-neutral format (YYYY-MM-DD HH:MM:SS) for the date and time.
    const localDateTimeString = now.toLocaleString('sv-SE', {
        timeZone: timeZone,
        hour12: false,
    });

    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Generated by Verum Omnis on ${localDateTimeString} (${timeZone})`, margin, pageHeight - 10);
    }
    
    const pdfBlob = doc.output('blob');
    const pdfHash = await hashData(await pdfBlob.arrayBuffer());
    return { pdfBlob, pdfHash };
};


const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [inputText, setInputText] = useState('');
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [sealingId, setSealingId] = useState<string | null>(null);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
    const keyPairRef = useRef<CryptoKeyPair | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const newChat = ai.chats.create({
            model: 'gemini-2.5-pro',
            config: { systemInstruction: CONSTITUTION_PROMPT }
        });
        setChat(newChat);
        setMessages([{
            id: 'initial',
            role: 'system',
            content: 'Welcome to Verum Omnis. Ask a legal question or drop evidence files to begin analysis.'
        }]);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                console.warn("Could not get user location:", error.message);
                setMessages(prev => [...prev, {
                    id: `system-location-error-${Date.now()}`,
                    role: 'system',
                    content: 'Could not retrieve geolocation. Jurisdictional analysis may be limited. Please ensure location services are enabled for this application.'
                }]);
            }
        );
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputText]);

    const handleSendMessage = useCallback(async () => {
        if ((!inputText.trim() && stagedFiles.length === 0) || !chat || isLoading) return;

        let userText = inputText;
        const filesToSend = stagedFiles;
        
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userText,
            fileNames: filesToSend.map(f => f.name)
        };
        setMessages(prev => [...prev, userMessage]);

        setInputText('');
        setStagedFiles([]);
        setIsLoading(true);

        try {
            const filesForSealing: FileData[] = await Promise.all(filesToSend.map(async file => {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                return { name: file.name, type: file.type, base64 };
            }));

            const modelMessageId = `model-${Date.now()}`;
            setMessages(prev => [...prev, { id: modelMessageId, role: 'model', content: '▋' }]);

            const parts: Part[] = [];
            let promptText = userText;
            if (userLocation) {
                promptText = `User is located at latitude: ${userLocation.latitude}, longitude: ${userLocation.longitude}. Please consider potential jurisdictional laws relevant to this area in your analysis.\n\nUser's query: ${userText}`;
            }

            if(promptText.trim()) parts.push({ text: promptText });
            filesForSealing.forEach(f => parts.push({ inlineData: { data: f.base64, mimeType: f.type || 'application/octet-stream' }}));
            
            const response = await chat.sendMessageStream({ message: parts });

            let fullResponseText = "";
            let firstChunk = true;
            for await (const chunk of response) {
                if (firstChunk) {
                    setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: '' } : m));
                    firstChunk = false;
                }
                fullResponseText += chunk.text;
                setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: fullResponseText + '▋' } : m));
            }
            setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: fullResponseText, filesForSealing } : m));

        } catch (error) {
            console.error("Analysis failed:", error);
            setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'system', content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`}]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, stagedFiles, chat, isLoading, userLocation]);

    const handleSealEvidence = useCallback(async (message: Message) => {
        if (!message.content || !message.filesForSealing) return;
        setSealingId(message.id);

        try {
            if (!keyPairRef.current) keyPairRef.current = await generateKeyPair();
            const keyPair = keyPairRef.current;

            const evidence_files = await Promise.all(message.filesForSealing.map(async f => ({
                file_name: f.name,
                sha512_original: await hashData(fileDataToBuffer(f))
            })));
            
            const publicKeyPem = await exportPublicKeyAsPem(keyPair.publicKey);
            const device_id_fingerprint = await hashData(publicKeyPem);

            const manifest = {
                version: "verum_v5.2.6",
                manifest_id: `urn:uuid:${crypto.randomUUID()}`,
                sealed_timestamp_utc: new Date().toISOString(),
                device_public_key: publicKeyPem,
                device_id_fingerprint,
                evidence_files,
                geolocation: userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : 'not available'
            };

            const signatureBuffer = await signData(keyPair.privateKey, JSON.stringify(manifest));
            const signature = bufferToBase64(signatureBuffer);
            
            const { pdfBlob, pdfHash } = await generateSealedPdf(message.content, message.filesForSealing, manifest, signature);

            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Verum-Omnis-Sealed-Report.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isSealed: true, manifest, signature, pdfHash } : m));

        } catch (error) {
            console.error("Failed to seal evidence:", error);
            alert("Sorry, there was an error sealing the report.");
        } finally {
            setSealingId(null);
        }
    }, [userLocation]);

    const handleRequestOnlineReview = useCallback(async (message: Message) => {
        if (!message.manifest || !message.signature || !chat) return;
        setReviewingId(message.id);

        try {
            const redacted_preview = message.content.substring(0, 500) + (message.content.length > 500 ? '...' : '');
            const reviewPrompt = `
                An on-device forensic analysis has been completed and sealed.
                Your task is to provide a high-level expert review based on the provided manifest and a redacted preview of the findings.
                DO NOT analyze the manifest's structure itself, but use its contents to inform your review of the redacted text.
                Provide a human-readable summary, assess potential legal implications based on the preview, and suggest next steps for a legal professional.

                **Manifest:**
                \`\`\`json
                ${JSON.stringify(message.manifest, null, 2)}
                \`\`\`

                **Redacted Preview:**
                ---
                ${redacted_preview}
                ---
            `;
            
            const reviewMessageId = `model-review-${Date.now()}`;
            setMessages(prev => [...prev, { id: reviewMessageId, role: 'model', content: '▋' }]);
            
            const response = await chat.sendMessageStream({ message: reviewPrompt });
            
            let fullResponseText = "";
            let firstChunk = true;
            for await (const chunk of response) {
                if(firstChunk) {
                    setMessages(prev => prev.map(m => m.id === reviewMessageId ? {...m, content: ''} : m));
                    firstChunk = false;
                }
                fullResponseText += chunk.text;
                setMessages(prev => prev.map(m => m.id === reviewMessageId ? { ...m, content: fullResponseText + '▋' } : m));
            }
            setMessages(prev => prev.map(m => m.id === reviewMessageId ? { ...m, content: fullResponseText } : m));

        } catch(error) {
            console.error("Online review failed:", error);
            setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'system', content: `An error occurred during online review: ${error instanceof Error ? error.message : String(error)}`}]);
        } finally {
            setReviewingId(null);
        }
    }, [chat]);
    
    const handleFileChange = (files: FileList | null) => files && setStagedFiles(prev => [...prev, ...Array.from(files)]);
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;
        setIsDragging(isEntering);
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    };
    
    return (
        <div 
            className="flex flex-col h-screen bg-background-dark text-text-light"
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragOver={(e) => handleDragEvents(e, true)}
        >
            {isDragging && (
                <div 
                    className="absolute inset-0 bg-primary/80 z-50 flex items-center justify-center border-4 border-dashed border-white rounded-2xl m-4"
                    onDragLeave={(e) => handleDragEvents(e, false)}
                    onDrop={handleDrop}
                >
                    <h2 className="text-3xl font-bold text-white">Drop Files to Analyze</h2>
                </div>
            )}

            <header className="flex-shrink-0 bg-background-dark border-b border-border-color p-4 shadow-md">
                 <h1 className="font-mono text-xl font-bold text-text-light text-center">
                    VERUM <span className="text-primary">OMNIS</span>
                </h1>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id}>
                            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-2xl p-4 rounded-lg ${
                                    msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 
                                    msg.role === 'model' ? 'bg-background-med border border-border-color text-text-light rounded-bl-none' :
                                    'border border-dashed border-border-color text-text-med text-center w-full'
                                }`}>
                                {(msg.fileNames && msg.fileNames.length > 0) && (
                                    <div className="mb-2 border-b border-white/20 pb-2">
                                        <p className="font-bold mb-2 text-sm">Attached {msg.fileNames.length} file(s):</p>
                                        <ul className="list-disc list-inside text-sm opacity-90">
                                            {msg.fileNames.map(f => <li key={f}>{f}</li>)}
                                        </ul>
                                    </div>
                                )}
                                    {msg.content && 
                                        <ReactMarkdown
                                            components={{
                                                blockquote: ({ node, children, ...props }) => {
                                                    const firstChildText = node?.children?.[0]?.children?.[0]?.children?.[0]?.value ?? '';
                                                    if (firstChildText.trim() === 'Contradiction Alert') {
                                                        return (
                                                            <div className="bg-red-900/20 border-l-4 border-red-500 p-4 my-2 rounded-r-lg">
                                                                {children}
                                                            </div>
                                                        );
                                                    }
                                                    return <blockquote className="border-l-4 border-border-color pl-4 italic text-text-med my-2" {...props}>{children}</blockquote>;
                                                },
                                                strong: ({ node, children, ...props }) => {
                                                    const text = node?.children?.[0]?.value ?? '';
                                                    if (text.trim() === 'Contradiction Alert') {
                                                        return (
                                                            <h3 className="text-red-400 font-bold text-lg mb-2 flex items-center">
                                                                <AlertTriangleIcon className="h-6 w-6 mr-3 flex-shrink-0" />
                                                                {children}
                                                            </h3>
                                                        );
                                                    }
                                                    return <strong {...props}>{children}</strong>;
                                                }
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    }
                                </div>
                            </div>
                            {msg.role === 'model' && msg.filesForSealing && msg.filesForSealing.length > 0 && !msg.content.endsWith('▋') && (
                                <div className="flex justify-start">
                                    <div className="mt-2 flex items-center gap-4 pl-2">
                                        { !msg.isSealed &&
                                            <button
                                                onClick={() => handleSealEvidence(msg)}
                                                disabled={sealingId === msg.id}
                                                className="flex items-center gap-2 text-xs text-text-med hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <SealIcon className="h-4 w-4" />
                                                {sealingId === msg.id ? 'Sealing...' : 'Seal Evidence'}
                                            </button>
                                        }
                                        { msg.isSealed &&
                                        <>
                                            <div className="flex items-center gap-2 text-xs text-success">
                                                <SealIcon className="h-4 w-4" />
                                                <span>Evidence Sealed (PDF downloaded)</span>
                                            </div>
                                            <button
                                                onClick={() => handleRequestOnlineReview(msg)}
                                                disabled={reviewingId === msg.id}
                                                className="flex items-center gap-2 text-xs text-text-med hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <CloudArrowUpIcon className="h-4 w-4" />
                                                {reviewingId === msg.id ? 'Reviewing...' : 'Request Online Review'}
                                            </button>
                                        </>
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-2xl p-4 rounded-lg bg-background-med border border-border-color text-text-light rounded-bl-none animate-pulse">
                                Verum Omnis is thinking...
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            <footer className="flex-shrink-0 p-4 bg-background-dark border-t border-border-color">
                <div className="max-w-4xl mx-auto">
                    {stagedFiles.length > 0 && (
                        <div className="mb-2 p-2 bg-background-med border border-border-color rounded-md">
                            <p className="text-sm font-bold mb-2">Staged files:</p>
                            <div className="flex flex-wrap gap-2">
                                {stagedFiles.map((file, index) => (
                                    <div key={`${file.name}-${index}`} className="bg-primary/20 text-text-light text-sm px-2 py-1 rounded-full flex items-center gap-2">
                                        <span>{file.name}</span>
                                        <button onClick={() => setStagedFiles(files => files.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-200">
                                            <XCircleIcon />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="relative flex items-end bg-background-med rounded-lg border border-border-color focus-within:border-primary transition-colors">
                        <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Ask a question or drop files..."
                            className="w-full bg-transparent p-3 pr-24 resize-none border-none focus:ring-0 text-text-light placeholder-text-med"
                            rows={1}
                            disabled={isLoading}
                        />
                         <div className="absolute right-2 bottom-2 flex items-center gap-2">
                            <label className={`relative text-text-med hover:text-primary ${isLoading ? 'opacity-50' : 'cursor-pointer'}`}>
                                <PaperclipIcon />
                                <input 
                                    type="file" 
                                    multiple 
                                    onChange={(e) => handleFileChange(e.target.files)} 
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    disabled={isLoading}
                                />
                            </label>
                            <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && stagedFiles.length === 0)} className="p-2 rounded-full bg-primary text-white disabled:bg-gray-500 transition-colors">
                                <SendIcon className="h-5 w-5" />
                            </button>
                         </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ChatInterface;
'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/config';

interface Job {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  documentType: string;
  email: string;
  ocrResult?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

interface JobStatusProps {
  jobId: string;
  onClose: () => void;
}

// OCR Result Display Component
function OCRResultDisplay({ ocrResult }: { ocrResult: string }) {
  const [activeTab, setActiveTab] = useState<'text' | 'analysis' | 'structured' | 'json'>('text');
  const [copied, setCopied] = useState(false);

  let parsedResult: any = null;
  try {
    parsedResult = JSON.parse(ocrResult);
  } catch {
    // If not JSON, treat as plain text
    parsedResult = null;
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">OCR Results</label>
        {parsedResult && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
              {parsedResult.confidence?.toFixed(1)}% confidence
            </span>
            {parsedResult.metadata?.processingTime && (
              <span className="text-gray-500">
                {(parsedResult.metadata.processingTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {parsedResult && (
        <div className="flex gap-2 mb-3 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📄 Plain Text
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'analysis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🔍 Document Analysis
          </button>
          <button
            onClick={() => setActiveTab('structured')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'structured'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🏗️ Block Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'json'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            💻 Raw JSON
          </button>
        </div>
      )}

      {/* Content */}
      <div className="relative">
        <button
          onClick={() => copyToClipboard(activeTab === 'text' && parsedResult ? parsedResult.text : ocrResult)}
          className="absolute top-2 right-2 p-2 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors z-10"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        <div className="max-h-96 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-4 pr-12">
          {activeTab === 'text' && parsedResult && (
            <div className="whitespace-pre-wrap text-sm text-gray-900">{parsedResult.text}</div>
          )}

          {activeTab === 'analysis' && parsedResult && (
            <div className="space-y-4 text-sm">
              {/* Document Type */}
              {parsedResult.structure?.documentType && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                        📄 Document Type
                      </h3>
                      <p className="text-lg font-bold text-blue-800 mt-1 capitalize">
                        {parsedResult.structure.documentType}
                      </p>
                    </div>
                    <div className="text-4xl">
                      {parsedResult.structure.documentType === 'invoice' && '🧾'}
                      {parsedResult.structure.documentType === 'receipt' && '🧾'}
                      {parsedResult.structure.documentType === 'form' && '📋'}
                      {parsedResult.structure.documentType === 'report' && '📊'}
                      {parsedResult.structure.documentType === 'letter' && '✉️'}
                      {parsedResult.structure.documentType === 'unknown' && '📄'}
                    </div>
                  </div>
                </div>
              )}

              {/* Document Overview */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  📊 Document Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Word Count:</span>
                    <span className="ml-2 font-medium">{parsedResult.metadata?.wordCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Line Count:</span>
                    <span className="ml-2 font-medium">{parsedResult.metadata?.lineCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Confidence:</span>
                    <span className="ml-2 font-medium">{parsedResult.metadata?.avgConfidence?.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Processing Time:</span>
                    <span className="ml-2 font-medium">{(parsedResult.metadata?.processingTime / 1000)?.toFixed(1)}s</span>
                  </div>
                </div>
              </div>

              {/* Notable Data - Extracted Entities */}
              {parsedResult.structure?.notableData && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-300">
                  <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    🔍 Notable Data Extracted
                  </h3>

                  {/* Identifiers (IBAN, Credit Cards, etc) */}
                  {parsedResult.structure.notableData.identifiers.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-orange-800 mb-2">🏦 Financial Identifiers</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {parsedResult.structure.notableData.identifiers.map((id: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white rounded p-2 text-xs border border-orange-200">
                            <span className="font-medium text-orange-700">{id.type}:</span>
                            <span className="font-mono text-gray-900 ml-2">{id.value}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(id.value)}
                              className="ml-2 p-1 hover:bg-orange-100 rounded"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Currency Amounts */}
                  {parsedResult.structure.notableData.currencyAmounts.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-orange-800 mb-2">💰 Currency Amounts</h4>
                      <div className="flex flex-wrap gap-2">
                        {parsedResult.structure.notableData.currencyAmounts.slice(0, 10).map((amount: any, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-mono font-bold">
                            {amount.currency}{amount.value}
                          </span>
                        ))}
                        {parsedResult.structure.notableData.currencyAmounts.length > 10 && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            +{parsedResult.structure.notableData.currencyAmounts.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Other Notable Entities */}
                  {parsedResult.structure.notableData.entities.filter((e: any) =>
                    !['currency', 'date'].includes(e.type) &&
                    !parsedResult.structure.notableData.identifiers.some((id: any) => id.value === (e.displayValue || e.value))
                  ).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-orange-800 mb-2">📋 Other Notable Items</h4>
                      <div className="space-y-1">
                        {parsedResult.structure.notableData.entities
                          .filter((e: any) =>
                            !['currency', 'date'].includes(e.type) &&
                            !parsedResult.structure.notableData.identifiers.some((id: any) => id.value === (e.displayValue || e.value))
                          )
                          .slice(0, 8)
                          .map((entity: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-white rounded p-2 border border-orange-200">
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                {entity.type.replace(/_/g, ' ').toUpperCase()}
                              </span>
                              <span className="font-mono text-gray-900 flex-1">{entity.displayValue || entity.value}</span>
                              {entity.context && (
                                <span className="text-gray-500 text-xs italic">({entity.context})</span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  {parsedResult.structure.notableData.dates.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-orange-800 mb-2">📅 Dates Found</h4>
                      <div className="flex flex-wrap gap-2">
                        {parsedResult.structure.notableData.dates.slice(0, 8).map((date: any, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {date.value}
                          </span>
                        ))}
                        {parsedResult.structure.notableData.dates.length > 8 && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{parsedResult.structure.notableData.dates.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Smart Fields */}
              {parsedResult.structure?.smartFields && parsedResult.structure.smartFields.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    🎯 Extracted Fields ({parsedResult.structure.smartFields.length})
                  </h3>
                  <div className="space-y-2">
                    {parsedResult.structure.smartFields.map((field: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs bg-white rounded p-2">
                        <span className="font-medium text-green-800">{field.fieldName}:</span>
                        <span className="text-gray-900 text-right ml-2 flex-1">{field.value}</span>
                        <span className="text-green-600 ml-2">{field.confidence?.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tables */}
              {parsedResult.structure?.tables && parsedResult.structure.tables.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📋 Tables Detected ({parsedResult.structure.tables.length})
                  </h3>
                  {parsedResult.structure.tables.map((table: any, idx: number) => (
                    <div key={idx} className="mb-4 last:mb-0">
                      <div className="text-xs text-gray-500 mb-2">
                        Table {idx + 1} - {table.rows} rows × {table.cols} columns
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border border-gray-300">
                          {table.headers && (
                            <thead className="bg-gray-100">
                              <tr>
                                {table.headers.map((header: string, hIdx: number) => (
                                  <th key={hIdx} className="border border-gray-300 px-2 py-1 text-left font-semibold">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {table.data.slice(0, 5).map((row: string[], rIdx: number) => (
                              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.map((cell: string, cIdx: number) => (
                                  <td key={cIdx} className="border border-gray-300 px-2 py-1">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {table.data.length > 5 && (
                          <div className="text-xs text-gray-500 mt-1 italic">
                            ... and {table.data.length - 5} more rows
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key-Value Pairs */}
              {parsedResult.structure?.keyValuePairs && parsedResult.structure.keyValuePairs.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    🔑 Key-Value Pairs ({parsedResult.structure.keyValuePairs.length})
                  </h3>
                  <div className="space-y-2">
                    {parsedResult.structure.keyValuePairs.slice(0, 10).map((pair: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-xs bg-gray-50 rounded p-2">
                        <span className="font-medium text-blue-700">{pair.key}:</span>
                        <span className="text-gray-900 text-right ml-2 flex-1">{pair.value}</span>
                      </div>
                    ))}
                    {parsedResult.structure.keyValuePairs.length > 10 && (
                      <div className="text-xs text-gray-500 italic">
                        ... and {parsedResult.structure.keyValuePairs.length - 10} more pairs
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Page Layout */}
              {parsedResult.structure?.pageLayout && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📐 Page Layout
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Columns:</span>
                      <span className="font-medium">{parsedResult.structure.pageLayout.columns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Has Header:</span>
                      <span className="font-medium">{parsedResult.structure.pageLayout.hasHeader ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Has Footer:</span>
                      <span className="font-medium">{parsedResult.structure.pageLayout.hasFooter ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Text Density:</span>
                      <span className="font-medium">{(parsedResult.structure.pageLayout.textDensity * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Title */}
              {parsedResult.structure?.title && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2 text-xs">📌 Detected Title</h3>
                  <div className="text-sm text-blue-800 font-medium">{parsedResult.structure.title}</div>
                </div>
              )}

              {/* Headings */}
              {parsedResult.structure?.headings && parsedResult.structure.headings.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📑 Headings ({parsedResult.structure.headings.length})
                  </h3>
                  <div className="space-y-2">
                    {parsedResult.structure.headings.slice(0, 10).map((heading: any, idx: number) => (
                      <div key={idx} className={`pl-${heading.level * 2} text-xs`}>
                        <span className="inline-block w-12 text-gray-400">H{heading.level}</span>
                        <span className="text-gray-900">{heading.text}</span>
                      </div>
                    ))}
                    {parsedResult.structure.headings.length > 10 && (
                      <div className="text-xs text-gray-500 italic">
                        ... and {parsedResult.structure.headings.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lists */}
              {parsedResult.structure?.lists && parsedResult.structure.lists.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📝 Lists Detected ({parsedResult.structure.lists.length})
                  </h3>
                  {parsedResult.structure.lists.slice(0, 3).map((list: any, idx: number) => (
                    <div key={idx} className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">List {idx + 1} ({list.items.length} items)</div>
                      <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                        {list.items.slice(0, 5).map((item: string, itemIdx: number) => (
                          <li key={itemIdx}>{item}</li>
                        ))}
                        {list.items.length > 5 && (
                          <li className="text-gray-500 italic">... and {list.items.length - 5} more items</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Content Types */}
              {parsedResult.blocks && parsedResult.blocks.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    🏷️ Content Types Found
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const contentTypes = new Set<string>();
                      parsedResult.blocks.forEach((block: any) => {
                        block.paragraphs?.forEach((para: any) => {
                          para.lines?.forEach((line: any) => {
                            line.words?.forEach((word: any) => {
                              if (word.contentType && word.contentType !== 'text') {
                                contentTypes.add(word.contentType);
                              }
                            });
                          });
                        });
                      });

                      const typeIcons: Record<string, string> = {
                        number: '🔢',
                        date: '📅',
                        email: '📧',
                        url: '🔗',
                        currency: '💰',
                        phone: '📞'
                      };

                      return Array.from(contentTypes).map(type => (
                        <span key={type} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          {typeIcons[type] || '📄'} {type}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Block Types */}
              {parsedResult.blocks && parsedResult.blocks.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📦 Block Analysis
                  </h3>
                  <div className="space-y-2 text-xs">
                    {parsedResult.blocks.map((block: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-gray-600">
                          Block {idx + 1} - {block.blockType}
                        </span>
                        <div className="flex gap-3 text-gray-500">
                          <span>{block.paragraphs?.length || 0} paragraphs</span>
                          <span className="text-green-600">{block.confidence?.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'structured' && parsedResult && (
            <div className="space-y-4">
              {parsedResult.blocks.map((block: any, blockIdx: number) => (
                <div key={blockIdx} className="border-l-4 border-blue-500 pl-4">
                  <div className="text-xs font-semibold text-blue-700 mb-2">
                    Block {blockIdx + 1} ({block.confidence?.toFixed(1)}% confidence)
                  </div>
                  {block.paragraphs.map((para: any, paraIdx: number) => (
                    <div key={paraIdx} className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">
                        Paragraph {paraIdx + 1}
                      </div>
                      {para.lines.map((line: any, lineIdx: number) => (
                        <div key={lineIdx} className="mb-1">
                          <span className="text-sm text-gray-900">{line.text}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            ({line.confidence?.toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'json' && (
            <pre className="text-xs text-gray-900 font-mono whitespace-pre-wrap">
              {JSON.stringify(parsedResult || ocrResult, null, 2)}
            </pre>
          )}

          {!parsedResult && (
            <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono">{ocrResult}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobStatus({ jobId, onClose }: JobStatusProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/status/${jobId}`));

        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }

        const data = await response.json();
        setJob(data);
        setLoading(false);

        // Stop polling if job is complete or failed
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          if (intervalId) {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setLoading(false);
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll every 2 seconds for updates
    intervalId = setInterval(fetchStatus, 2000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'PROCESSING':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'COMPLETED':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'FAILED':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Job Status</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${getStatusColor(job.status)}`}>
            {getStatusIcon(job.status)}
            <span className="font-semibold">{job.status}</span>
          </div>
          {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
            <span className="text-sm text-gray-500">Polling for updates...</span>
          )}
        </div>

        {/* Job Details */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-500">Job ID</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono break-all">
                {job.id}
              </code>
              <button
                onClick={() => copyToClipboard(job.id)}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Document Type</label>
              <p className="mt-1 text-gray-900">{job.documentType}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="mt-1 text-gray-900 break-all">{job.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Created</label>
              <p className="mt-1 text-gray-900 text-sm">
                {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
            {job.processedAt && (
              <div>
                <label className="text-sm font-medium text-gray-500">Processed</label>
                <p className="mt-1 text-gray-900 text-sm">
                  {new Date(job.processedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* OCR Result */}
        {job.status === 'COMPLETED' && job.ocrResult && (
          <OCRResultDisplay ocrResult={job.ocrResult} />
        )}

        {/* Error Message */}
        {job.status === 'FAILED' && job.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <label className="text-sm font-medium text-red-800 block mb-2">Error</label>
            <p className="text-sm text-red-700">{job.errorMessage}</p>
          </div>
        )}

        {/* Processing Message */}
        {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-blue-800">
              {job.status === 'PENDING'
                ? 'Your document is queued for processing...'
                : 'Processing your document now...'}
            </p>
            <p className="text-sm text-blue-600 mt-2">
              This page will automatically update when processing completes.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
          >
            {job.status === 'COMPLETED' || job.status === 'FAILED' ? 'Close' : 'Cancel'}
          </button>
          {(job.status === 'COMPLETED' || job.status === 'FAILED') && (
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Process Another Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

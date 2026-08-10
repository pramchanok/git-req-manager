import type { MRDiscussion, MRNote } from '../../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { formatDateTime } from '../../utils/dateFormat'

const FALLBACK_AVATAR =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'

function Avatar({ note, className }: { note: MRNote; className: string }) {
  return (
    <img
      src={note.author.avatarUrl || FALLBACK_AVATAR}
      alt={note.author.name}
      title={note.author.name}
      className={`rounded-full bg-gray-800 border border-gray-700 object-cover ${className}`}
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = FALLBACK_AVATAR
      }}
    />
  )
}

interface DiscussionThreadProps {
  discussions: MRDiscussion[]
  loading: boolean
  mrWebUrl: string
  onOpenCommitDiff: (diff: { fromSha?: string; toSha: string }) => void
}

/** ส่วน Activity & Discussions ของ MR (system notes + comment threads) */
export default function DiscussionThread({ discussions, loading, mrWebUrl, onOpenCommitDiff }: DiscussionThreadProps) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
        Activity & Discussions
      </h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="text-center py-12 bg-[#161b22] border border-gray-800 border-dashed rounded-xl">
          <p className="text-gray-500 text-sm">No discussions yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {discussions.map(d => (
            <div key={d.id} className="relative group">
              {d.notes.length > 1 && (
                <div className="absolute top-10 bottom-4 left-5 w-[2px] bg-gray-800 rounded-full" />
              )}
              <div className="space-y-4">
                {d.notes.map((note: MRNote, index: number) => {
                  if (note.system) {
                    return (
                      <div key={note.id} className={`flex items-center gap-3 relative z-10 py-1 ${index > 0 ? 'ml-12' : 'ml-2'}`}>
                        <Avatar note={note} className="w-7 h-7 shrink-0" />
                        <div className="flex-1 flex flex-col gap-1 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-300">{note.author.name}</span>
                            <time className="text-xs text-gray-600 ml-auto" dateTime={note.createdAt} title={note.createdAt}>
                              {formatDateTime(note.createdAt)}
                            </time>
                          </div>
                          <div
                            className="prose prose-invert prose-sm max-w-none prose-p:my-0 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:bg-[#21262d] [&_a]:border [&_a]:border-gray-700 hover:[&_a]:border-gray-500 [&_a]:text-gray-200 [&_a]:px-3 [&_a]:py-1.5 [&_a]:rounded-md [&_a]:text-[12px] [&_a]:font-semibold hover:[&_a]:bg-[#30363d] [&_a]:no-underline [&_a]:transition-colors [&_a]:shadow-sm [&_a]:cursor-pointer [&_ul]:my-2 [&_ul]:list-none [&_ul]:pl-0 [&_li]:my-1.5 [&_li]:bg-[#161b22] [&_li]:border [&_li]:border-gray-800 [&_li]:rounded-lg [&_li]:px-3 [&_li]:py-2.5 [&_li]:text-gray-300 [&_li]:font-mono [&_li]:text-[13px] [&_li]:shadow-sm"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(note.body) as string) }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName === 'A') {
                                e.preventDefault();
                                const href = target.getAttribute('href');
                                if (href) {
                                  if (href.includes('/diffs?')) {
                                    const hashes = Array.from(note.body.matchAll(/[a-f0-9]{8,40}/gi)).map(m => m[0]);
                                    const urlStartShaMatch = href.match(/start_sha=([a-f0-9]+)/i);
                                    const startSha = urlStartShaMatch ? urlStartShaMatch[1] : undefined;
                                    const commitHashes = hashes.filter(h => h.length >= 8 && h !== startSha && !/^\d+$/.test(h));

                                    if (commitHashes.length >= 2) {
                                      onOpenCommitDiff({ fromSha: commitHashes[0], toSha: commitHashes[commitHashes.length - 1] });
                                      return;
                                    } else if (commitHashes.length === 1) {
                                      onOpenCommitDiff({ toSha: commitHashes[0] });
                                      return;
                                    }
                                  }
                                  let fullUrl = href;
                                  if (href.startsWith('/')) {
                                    try {
                                      const origin = new URL(mrWebUrl).origin;
                                      fullUrl = origin + href;
                                    } catch {}
                                  }
                                  window.electronAPI.openUrl(fullUrl);
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={note.id} className={`flex gap-4 relative z-10 ${index > 0 ? 'ml-12' : ''}`}>
                      <Avatar note={note} className={index === 0 ? 'w-10 h-10' : 'w-8 h-8 mt-1'} />
                      <div className="flex-1 bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden transition-colors hover:border-gray-700 shadow-sm">
                        <div className="bg-gray-800/30 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                          <span className="font-semibold text-gray-200 text-sm">{note.author.name}</span>
                          <time className="text-gray-500 text-xs" dateTime={note.createdAt} title={note.createdAt}>
                            {formatDateTime(note.createdAt)}
                          </time>
                        </div>
                        <div className="px-4 py-3 text-sm text-gray-300 prose prose-invert prose-orange max-w-none prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-code:text-orange-200 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-gray-800">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{note.body}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

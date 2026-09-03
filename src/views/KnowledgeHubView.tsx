import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KnowledgeItem } from '../types';
import { 
  FileText, 
  Plus, 
  Search, 
  Tag, 
  Link as LinkIcon, 
  Trash2, 
  Edit2, 
  ExternalLink,
  Sparkles,
  Check,
  Calendar,
  Copy,
  CheckCircle2,
  Folder,
  Layers,
  BookOpen,
  X,
  Share2
} from 'lucide-react';
import { formatDisplayDate } from '../utils/timeUtils';

export const KnowledgeHubView: React.FC = () => {
  const { 
    knowledge, 
    categories, 
    addKnowledgeItem, 
    updateKnowledgeItem, 
    deleteKnowledgeItem, 
    searchQuery 
  } = useApp();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'VRTX');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [linkInput, setLinkInput] = useState('');

  // Filtered Notes
  const filteredNotes = knowledge.filter(item => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
      const matchCategory = item.category.toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchTags && !matchCategory) return false;
    }
    return true;
  });

  const handleCreateNote = () => {
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const links = linkInput ? [linkInput.trim()] : [];

    addKnowledgeItem({
      title: title.trim(),
      category,
      content: content.trim(),
      tags,
      links
    });

    setTitle('');
    setContent('');
    setTagsInput('');
    setLinkInput('');
    setShowAddForm(false);
  };

  const handleUpdateNote = () => {
    if (!editingItem || !editingItem.title.trim()) return;
    updateKnowledgeItem(editingItem);
    setEditingItem(null);
  };

  const handleCopyNote = (item: KnowledgeItem) => {
    const textToCopy = `${item.title}\nCategory: ${item.category}\nTags: ${item.tags.join(', ')}\n\n${item.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract all unique tags
  const allTags = Array.from(new Set(knowledge.flatMap(k => k.tags)));

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner - Exact Reminder Style */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-theme-text tracking-tight font-display">
                Notes & Knowledge Hub
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                {knowledge.length} Total Notes
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                {allTags.length} Tags
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Quick captures, architectural documentation, research findings, and technical notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
          }`}
        >
          All Notes ({knowledge.length})
        </button>

        {categories.map(c => {
          const count = knowledge.filter(k => k.category === c.name).length;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === c.name
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              <span>{c.name}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === c.name ? 'bg-white/20 text-white' : 'bg-theme-card-hover text-theme-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Note Card (Toggleable Glass Panel) */}
      {showAddForm && (
        <div className="glass-panel p-6 rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 shadow-xl space-y-4 animate-slide-up bg-indigo-50/20 dark:bg-indigo-950/10">
          <div className="flex items-center justify-between border-b border-theme-border pb-3">
            <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Create New Knowledge Note
            </h3>
            <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-lg">
              Category: {category}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-theme-text block mb-1">
                Note Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Distributed Consensus Engine Specs & Benchmarks..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-theme-card border border-theme-border text-theme-text font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text block mb-1 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                Category Domain
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-theme-text block mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-500" />
                Tags (Comma-Separated)
              </label>
              <input
                type="text"
                placeholder="e.g. architecture, redis, caching, api"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-theme-text block mb-1">
                Note Content / Markdown / Technical Findings
              </label>
              <textarea
                rows={5}
                placeholder="Write detailed notes, checklists, architectural patterns, or technical findings..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-theme-text block mb-1 flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                Reference Link / Documentation URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://github.com/... or https://docs..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-theme-border">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNote}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              Save Knowledge Note
            </button>
          </div>
        </div>
      )}

      {/* Notes List (Same style as Reminder Cards) */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-xs text-theme-muted">
            No notes found matching your filters. Click &quot;New Note&quot; to create one.
          </div>
        ) : (
          filteredNotes.map(item => {
            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl border bg-theme-card border-indigo-200/60 dark:border-indigo-900/60 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 shadow-sm shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category Badge */}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-xs">
                        {item.category}
                      </span>

                      {/* Date Badge */}
                      <span className="font-mono text-xs font-bold text-theme-text bg-theme-card-hover px-2 py-0.5 rounded border border-theme-border flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-theme-muted" />
                        {formatDisplayDate(new Date(item.updatedAt || item.createdAt))}
                      </span>

                      {/* Tags */}
                      {item.tags.map((tag, idx) => (
                        <span 
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 flex items-center gap-0.5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <h4 className="text-base font-bold text-theme-text font-openSans leading-snug">
                      {item.title}
                    </h4>

                    {item.content && (
                      <p className="text-xs text-theme-muted line-clamp-3 font-mono leading-relaxed whitespace-pre-line bg-theme-card-hover/40 p-2 rounded-lg border border-theme-border/50">
                        {item.content}
                      </p>
                    )}

                    {/* Links */}
                    {item.links && item.links.length > 0 && (
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        {item.links.map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{link}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-theme-border shrink-0">
                  <button
                    onClick={() => handleCopyNote(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-theme-card-hover hover:bg-theme-border text-theme-text text-xs font-bold transition-colors"
                    title="Copy Note Content"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setEditingItem(item)}
                    className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted hover:text-theme-text transition-colors"
                    title="Edit Note"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => deleteKnowledgeItem(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Note Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-theme-card border border-theme-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-500" />
                Edit Knowledge Note
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-theme-card-hover text-theme-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-theme-text block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-theme-text block mb-1">
                    Category
                  </label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-bold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-theme-text block mb-1">
                    Tags (Comma-Separated)
                  </label>
                  <input
                    type="text"
                    value={editingItem.tags.join(', ')}
                    onChange={(e) => setEditingItem({ 
                      ...editingItem, 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                    className="w-full px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-theme-text block mb-1">
                  Content
                </label>
                <textarea
                  rows={6}
                  value={editingItem.content}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-theme-border">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateNote}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

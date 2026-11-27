import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Film,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { DailyUpdateItem, DailyUpdateMediaType } from '../../types/coaching';
import {
  filterDailyUpdates,
  formatDisplayDate,
  isPdfFileOrUrl,
  isVideoFileOrUrl,
  validateDailyUpdateInput,
} from '../../utils/coachingLogic';
import { ResilientImage } from '../ResilientImage';

interface AdminDailyUpdatesTabProps {
  updates: DailyUpdateItem[];
  saving: boolean;
  uploadingFile: boolean;
  onUploadFile: (file: File) => Promise<string | null>;
  onCreateUpdate: (draft: {
    title: string;
    description: string;
    date: string;
    mediaType: DailyUpdateMediaType;
    mediaUrl?: string;
    fileName?: string;
    published: boolean;
  }) => Promise<boolean>;
  onSaveEditUpdate: (
    id: string,
    next: {
      title: string;
      description: string;
      date: string;
      mediaType: DailyUpdateMediaType;
      mediaUrl?: string;
      fileName?: string;
      published: boolean;
    },
  ) => Promise<boolean>;
  onTogglePublishUpdate: (item: DailyUpdateItem) => Promise<void>;
  onDeleteUpdate: (id: string) => Promise<void>;
  onValidationError: (msg: string) => void;
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDailyUpdatesTab({
  updates,
  saving,
  uploadingFile,
  onUploadFile,
  onCreateUpdate,
  onSaveEditUpdate,
  onTogglePublishUpdate,
  onDeleteUpdate,
  onValidationError,
}: AdminDailyUpdatesTabProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayDateString);
  const [mediaType, setMediaType] = useState<DailyUpdateMediaType>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [published, setPublished] = useState(true);

  const [filterType, setFilterType] = useState<'all' | DailyUpdateMediaType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline editor state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMediaType, setEditMediaType] = useState<DailyUpdateMediaType>('none');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editFileName, setEditFileName] = useState('');
  const [editPublished, setEditPublished] = useState(true);

  const filteredUpdates = useMemo(
    () => filterDailyUpdates(updates, filterType, searchQuery, true),
    [updates, filterType, searchQuery],
  );

  function inferMediaTypeFromInput(url: string, fallback: DailyUpdateMediaType): DailyUpdateMediaType {
    const clean = url.trim();
    if (!clean) return fallback;
    if (isPdfFileOrUrl(clean)) return 'pdf';
    if (isVideoFileOrUrl(clean) || /youtu\.?be/.test(clean.toLowerCase())) return 'video';
    return fallback === 'none' ? 'image' : fallback;
  }

  async function handleNewFileSelect(file: File | undefined) {
    if (!file) return;
    const uploadedUrl = await onUploadFile(file);
    if (!uploadedUrl) return;
    setMediaUrl(uploadedUrl);
    setFileName(file.name);
    if (isPdfFileOrUrl(file.name, file.type)) {
      setMediaType('pdf');
    } else if (isVideoFileOrUrl(file.name, file.type)) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    }
  }

  async function handleEditFileSelect(file: File | undefined) {
    if (!file) return;
    const uploadedUrl = await onUploadFile(file);
    if (!uploadedUrl) return;
    setEditMediaUrl(uploadedUrl);
    setEditFileName(file.name);
    if (isPdfFileOrUrl(file.name, file.type)) {
      setEditMediaType('pdf');
    } else if (isVideoFileOrUrl(file.name, file.type)) {
      setEditMediaType('video');
    } else {
      setEditMediaType('image');
    }
  }

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    const resolvedType: DailyUpdateMediaType = !mediaUrl.trim()
      ? 'none'
      : inferMediaTypeFromInput(mediaUrl, mediaType);

    const check = validateDailyUpdateInput({
      title,
      description,
      date,
      mediaType: resolvedType,
      mediaUrl: resolvedType === 'none' ? undefined : mediaUrl,
    });
    if (!check.valid) {
      onValidationError(check.error || 'Please fill in all required update fields.');
      return;
    }

    const ok = await onCreateUpdate({
      title: title.trim(),
      description: description.trim(),
      date: date.trim(),
      mediaType: resolvedType,
      mediaUrl: resolvedType === 'none' ? undefined : mediaUrl.trim(),
      fileName: resolvedType === 'none' ? undefined : fileName.trim() || undefined,
      published,
    });

    if (ok) {
      setTitle('');
      setDescription('');
      setDate(getTodayDateString());
      setMediaType('image');
      setMediaUrl('');
      setFileName('');
      setPublished(true);
    }
  }

  function openEdit(item: DailyUpdateItem) {
    if (editId === item.id) {
      setEditId(null);
      return;
    }
    setEditId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditDate(item.date);
    setEditMediaType(item.mediaType);
    setEditMediaUrl(item.mediaUrl || '');
    setEditFileName(item.fileName || '');
    setEditPublished(item.published);
  }

  async function handleSaveEdit(id: string) {
    const resolvedType: DailyUpdateMediaType = !editMediaUrl.trim()
      ? 'none'
      : inferMediaTypeFromInput(editMediaUrl, editMediaType);

    const check = validateDailyUpdateInput({
      title: editTitle,
      description: editDescription,
      date: editDate,
      mediaType: resolvedType,
      mediaUrl: resolvedType === 'none' ? undefined : editMediaUrl,
    });
    if (!check.valid) {
      onValidationError(check.error || 'Please fill in valid update details.');
      return;
    }

    const ok = await onSaveEditUpdate(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      date: editDate.trim(),
      mediaType: resolvedType,
      mediaUrl: resolvedType === 'none' ? undefined : editMediaUrl.trim(),
      fileName: resolvedType === 'none' ? undefined : editFileName.trim() || undefined,
      published: editPublished,
    });
    if (ok) {
      setEditId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Create Daily Update Form */}
      <form
        onSubmit={handleSubmitNew}
        className="p-5 rounded-xl bg-[#0D0F14] border border-zinc-800 space-y-4"
      >
        <div>
          <h3 className="text-sm font-bold text-white">
            Post New Daily Update (Photo, Video, PDF, or Notice)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload a photo, video, PDF document, or write a notice with Title and Date. All past updates stay archived chronologically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="admin-upd-title" className="block text-xs font-semibold text-slate-300 mb-1">
              Update Title *
            </label>
            <input
              id="admin-upd-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Class 10 Science Test Schedule or Batch Photo"
              className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="admin-upd-date" className="block text-xs font-semibold text-slate-300 mb-1">
              Update Date *
            </label>
            <input
              id="admin-upd-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="admin-upd-type" className="block text-xs font-semibold text-slate-300 mb-1">
              Content Type
            </label>
            <select
              id="admin-upd-type"
              value={mediaType}
              onChange={(e) => {
                const next = e.target.value as DailyUpdateMediaType;
                setMediaType(next);
                if (next === 'none') {
                  setMediaUrl('');
                  setFileName('');
                }
              }}
              className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="image">Photo</option>
              <option value="video">Video</option>
              <option value="pdf">PDF Document</option>
              <option value="none">Text Notice Only</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="admin-upd-media-url" className="block text-xs font-semibold text-slate-300 mb-1">
              Upload Photo / Video / PDF or Paste URL {mediaType === 'none' ? '(Disabled for Text Notice)' : ''}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="admin-upd-media-url"
                type="text"
                value={mediaUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setMediaUrl(val);
                  if (val.trim()) {
                    setMediaType(inferMediaTypeFromInput(val, mediaType));
                  }
                }}
                placeholder="Upload a file or paste image / YouTube / PDF link"
                className="flex-1 px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{uploadingFile ? 'Uploading...' : 'Upload Photo / Video / PDF'}</span>
                <input
                  id="admin-upd-file-input"
                  type="file"
                  accept="image/*,video/*,application/pdf,.pdf"
                  className="sr-only"
                  disabled={saving || uploadingFile}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    await handleNewFileSelect(file);
                  }}
                />
              </label>

              {mediaUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setFileName('');
                    setMediaType('none');
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-red-400 bg-[#141720] border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            {fileName && (
              <p className="mt-1 text-[11px] font-mono text-blue-400 truncate">
                Attached: {fileName}
              </p>
            )}
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="admin-upd-desc" className="block text-xs font-semibold text-slate-300">
                Update Description / Details
              </label>
              {description.trim() && (
                <button
                  type="button"
                  onClick={() => setDescription('')}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Clear Description
                </button>
              )}
            </div>
            <textarea
              id="admin-upd-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write full announcement details, instructions for students, or caption..."
              className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-[#09090B] text-blue-600"
            />
            <span>Publish immediately to Daily Updates</span>
          </label>

          <button
            type="submit"
            disabled={saving || uploadingFile}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Publishing...' : 'Publish Daily Update'}</span>
          </button>
        </div>
      </form>

      {/* Filter, Search & List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">
            All Daily Updates ({filteredUpdates.length} of {updates.length})
          </h3>
          <div className="relative sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="admin-upd-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search updates or date..."
              aria-label="Search daily updates"
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: `All (${updates.length})` },
              {
                id: 'image',
                label: `Photos (${filterDailyUpdates(updates, 'image', '', true).length})`,
              },
              {
                id: 'video',
                label: `Videos (${filterDailyUpdates(updates, 'video', '', true).length})`,
              },
              {
                id: 'pdf',
                label: `PDFs (${filterDailyUpdates(updates, 'pdf', '', true).length})`,
              },
              {
                id: 'none',
                label: `Notices (${filterDailyUpdates(updates, 'none', '', true).length})`,
              },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                filterType === btn.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#0D0F14] text-slate-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {filteredUpdates.length === 0 ? (
          <div className="p-8 rounded-xl border border-zinc-800 bg-[#0D0F14] text-center text-sm text-slate-400">
            No daily updates match this filter yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            {filteredUpdates.map((item) => {
              const isEditingThis = editId === item.id;
              return (
                <div key={item.id} className="bg-[#111318]">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-[#09090B] shrink-0 flex items-center justify-center">
                        {item.mediaType === 'image' && item.mediaUrl ? (
                          <ResilientImage
                            src={item.mediaUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : item.mediaType === 'pdf' ? (
                          <FileText className="w-6 h-6 text-red-400" aria-hidden="true" />
                        ) : item.mediaType === 'video' ? (
                          <Film className="w-6 h-6 text-blue-400" aria-hidden="true" />
                        ) : (
                          <Bell className="w-5 h-5 text-blue-400" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {item.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="inline-flex items-center gap-1 font-mono text-blue-400 tabular-nums">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            <span>{formatDisplayDate(item.date)}</span>
                          </span>
                          <span>·</span>
                          <span className="uppercase">{item.mediaType === 'none' ? 'Notice' : item.mediaType}</span>
                          <span>·</span>
                          <span className={item.published ? 'text-blue-400' : 'text-red-400'}>
                            {item.published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onTogglePublishUpdate(item)}
                        aria-label={`${item.published ? 'Unpublish' : 'Publish'} ${item.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 border border-zinc-700 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        {item.published ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Unpublish</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Publish</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.title}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg cursor-pointer ${
                          isEditingThis
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'text-slate-200 border-zinc-700 hover:bg-zinc-800'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isEditingThis ? 'Close Edit' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void onDeleteUpdate(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {isEditingThis && (
                    <div className="px-4 pb-4 pt-3 border-t border-zinc-800 bg-[#0D0F14] space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label
                            htmlFor={`inline-upd-title-${item.id}`}
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            Title
                          </label>
                          <input
                            id={`inline-upd-title-${item.id}`}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`inline-upd-date-${item.id}`}
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            Date
                          </label>
                          <input
                            id={`inline-upd-date-${item.id}`}
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`inline-upd-type-${item.id}`}
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            Type
                          </label>
                          <select
                            id={`inline-upd-type-${item.id}`}
                            value={editMediaType}
                            onChange={(e) => {
                              const next = e.target.value as DailyUpdateMediaType;
                              setEditMediaType(next);
                              if (next === 'none') {
                                setEditMediaUrl('');
                                setEditFileName('');
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100"
                          >
                            <option value="image">Photo</option>
                            <option value="video">Video</option>
                            <option value="pdf">PDF Document</option>
                            <option value="none">Text Notice</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label
                            htmlFor={`inline-upd-url-${item.id}`}
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            Media URL / Uploaded File
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              id={`inline-upd-url-${item.id}`}
                              type="text"
                              value={editMediaUrl}
                              onChange={(e) => setEditMediaUrl(e.target.value)}
                              className="flex-1 px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100"
                            />
                            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer shrink-0">
                              <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{uploadingFile ? 'Uploading...' : 'Replace Media'}</span>
                              <input
                                type="file"
                                accept="image/*,video/*,application/pdf,.pdf"
                                className="sr-only"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  await handleEditFileSelect(file);
                                }}
                              />
                            </label>
                            {editMediaUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditMediaUrl('');
                                  setEditFileName('');
                                  setEditMediaType('none');
                                }}
                                className="px-3 py-2 text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-950/40 rounded-lg cursor-pointer"
                              >
                                Remove Media
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <label
                              htmlFor={`inline-upd-desc-${item.id}`}
                              className="block text-xs font-semibold text-slate-300"
                            >
                              Description
                            </label>
                            {editDescription.trim() && (
                              <button
                                type="button"
                                onClick={() => setEditDescription('')}
                                className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                              >
                                Clear Description
                              </button>
                            )}
                          </div>
                          <textarea
                            id={`inline-upd-desc-${item.id}`}
                            rows={3}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-[#09090B] border border-zinc-700 rounded-lg text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editPublished}
                            onChange={(e) => setEditPublished(e.target.checked)}
                            className="w-4 h-4 rounded border-zinc-700 bg-[#09090B]"
                          />
                          <span>Published on Daily Updates</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-[#141720] border border-zinc-700 hover:bg-zinc-800 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving || uploadingFile}
                            onClick={() => void handleSaveEdit(item.id)}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

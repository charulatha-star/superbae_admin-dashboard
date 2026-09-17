'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fetchApi, uploadApi } from '@/src/lib/api/api';
import { Loader } from '@/src/components/admin/Loader';
import { Toast } from '@/src/components/admin/Toast';
import { ArrowLeft, ImageIcon, Trash2 } from 'lucide-react';
import formStyles from '../admins/create/page.module.css';
import eventStyles from './page.module.css';

interface Event {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  attendees: number;
  capacity: number;
  registeredCount?: number;
  checkedInCount: number;
  host: string;
  category: string;
  description?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  reminderConfig?: { enabled?: boolean; sendBeforeHours?: number };
  createdAt?: string;
  updatedAt?: string;
}

type EventForm = Omit<Event, 'id' | 'attendees' | 'checkedInCount'>;

const emptyForm: EventForm = {
  title: '', type: 'online', date: '', status: 'upcoming', capacity: 100, host: '', category: '',
  description: '', location: '', imageUrl: '', reminderConfig: { enabled: false, sendBeforeHours: 24 },
};

function validateField(name: string, value: unknown, form: EventForm): string {
  if (name === 'title') {
    const text = String(value ?? '').trim();
    if (!text) return 'Title is required.';
  }
  if (name === 'category') {
    const text = String(value ?? '').trim();
    if (!text) return 'Category is required.';
  }
  if (name === 'date') {
    const text = String(value ?? '').trim();
    if (!text) return 'Date is required.';
    if (new Date(text).getTime() <= Date.now()) return 'Event date must be in the future.';
  }
  if (name === 'capacity') {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) return 'Capacity must be a positive integer.';
  }
  if (name === 'reminderHours' && form.reminderConfig?.enabled) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 'Reminder hours must be greater than 0.';
  }
  return '';
}

interface EventFormProps {
  editingId?: string | null;
  onSuccess?: (event: Event) => void;
}

export default function EventForm({ editingId, onSuccess }: EventFormProps) {
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editing, setEditing] = useState<Event | null>(null);
  const [loading, setLoading] = useState(!!editingId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      fetchApi<Event>(`/events/${editingId}`)
        .then((data) => {
          setEditing(data);
          setForm({
            title: data.title || '',
            type: data.type || 'online',
            date: data.date ? String(data.date).slice(0, 16) : '',
            status: data.status || 'upcoming',
            capacity: data.capacity || 100,
            host: data.host || '',
            category: data.category || '',
            description: data.description || '',
            location: data.location || '',
            imageUrl: '',
            reminderConfig: {
              enabled: data.reminderConfig?.enabled || false,
              sendBeforeHours: data.reminderConfig?.sendBeforeHours || 24,
            },
          });
          setImagePreview(data.imageUrl || null);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }
  }, [editingId]);

  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const err = validateField('title', form.title, form);
    if (err) errors.title = err;
    const catErr = validateField('category', form.category, form);
    if (catErr) errors.category = catErr;
    const dateErr = validateField('date', form.date, form);
    if (dateErr) errors.date = dateErr;
    const capErr = validateField('capacity', form.capacity, form);
    if (capErr) errors.capacity = capErr;
    if (form.reminderConfig?.enabled) {
      const remErr = validateField('reminderHours', form.reminderConfig.sendBeforeHours, form);
      if (remErr) errors.reminderHours = remErr;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (file: File | null) => {
    setImageFile(file);
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(editing?.imageUrl || null);
    }
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setError('Please fix the errors above.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let imageUrl = editing?.imageUrl || '';
      if (imageFile) {
        const uploaded = await uploadApi<{ imageUrl: string }>('/events/upload-image', imageFile);
        imageUrl = uploaded.imageUrl;
      }
      const payload = { ...form, imageUrl, capacity: Number(form.capacity), reminderConfig: {
        enabled: !!form.reminderConfig?.enabled, sendBeforeHours: Number(form.reminderConfig?.sendBeforeHours || 24),
      } };
      const url = editingId ? `/events/${editingId}` : '/events';
      const saved = await fetchApi<Event>(url, {
        method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      setToast({ message: editingId ? 'Event updated successfully.' : 'Event created successfully.', type: 'success' });
      setTimeout(() => { onSuccess?.(saved); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save event or upload image.');
      setToast({ message: e instanceof Error ? e.message : 'Failed to save event.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={formStyles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <div className={formStyles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={formStyles.header}>
        <Link href="/admin/events" className={formStyles.backBtn}>
          <ArrowLeft size={16} /> Back to Events
        </Link>
        <h1 className={formStyles.title}>{editingId ? 'Edit Event' : 'Create Event'}</h1>
        <p className={formStyles.subtitle}>
          {editingId ? 'Update event details and scheduling.' : 'Fill in the details to create a new event.'}
        </p>
      </div>

      <div className={formStyles.content}>
        <form className={formStyles.form} onSubmit={saveEvent}>
          {error && <div className={formStyles.errorAlert}>{error}</div>}

          {/* Basic Info */}
          <div className={formStyles.formSection}>
            <h3 className={formStyles.sectionTitle}>Basic Information</h3>
            <div className={formStyles.grid}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Title</label>
                <input
                  className={`${formStyles.input} ${fieldErrors.title ? formStyles.inputError : ''}`}
                  required
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value }); if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: '' }); }}
                  onBlur={(e) => setFieldErrors({ ...fieldErrors, title: validateField('title', e.target.value, form) })}
                />
                {fieldErrors.title && <div className={formStyles.errorText}>{fieldErrors.title}</div>}
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Category</label>
                <input
                  className={`${formStyles.input} ${fieldErrors.category ? formStyles.inputError : ''}`}
                  required
                  value={form.category}
                  onChange={(e) => { setForm({ ...form, category: e.target.value }); if (fieldErrors.category) setFieldErrors({ ...fieldErrors, category: '' }); }}
                  onBlur={(e) => setFieldErrors({ ...fieldErrors, category: validateField('category', e.target.value, form) })}
                />
                {fieldErrors.category && <div className={formStyles.errorText}>{fieldErrors.category}</div>}
              </div>
            </div>
            <div className={formStyles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={formStyles.label}>Description</label>
              <textarea
                className={formStyles.input}
                rows={3}
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className={formStyles.formSection}>
            <h3 className={formStyles.sectionTitle}>Scheduling</h3>
            <div className={formStyles.grid}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Type</label>
                <select className={formStyles.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="online">Online</option>
                  <option value="in-person">Offline</option>
                </select>
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Host</label>
                <input className={formStyles.input} value={form.host || ''} onChange={(e) => setForm({ ...form, host: e.target.value })} />
              </div>
            </div>
            <div className={formStyles.grid}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Date &amp; Time</label>
                <input
                  className={`${formStyles.input} ${fieldErrors.date ? formStyles.inputError : ''}`}
                  required
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => { setForm({ ...form, date: e.target.value }); if (fieldErrors.date) setFieldErrors({ ...fieldErrors, date: '' }); }}
                  onBlur={(e) => setFieldErrors({ ...fieldErrors, date: validateField('date', e.target.value, form) })}
                />
                {fieldErrors.date && <div className={formStyles.errorText}>{fieldErrors.date}</div>}
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>Location</label>
                <input className={formStyles.input} value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className={formStyles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={formStyles.label}>Capacity</label>
              <input
                className={`${formStyles.input} ${fieldErrors.capacity ? formStyles.inputError : ''}`}
                required
                min="1"
                type="number"
                value={form.capacity}
                onChange={(e) => { setForm({ ...form, capacity: Number(e.target.value) }); if (fieldErrors.capacity) setFieldErrors({ ...fieldErrors, capacity: '' }); }}
                onBlur={(e) => setFieldErrors({ ...fieldErrors, capacity: validateField('capacity', e.target.value, form) })}
              />
              {fieldErrors.capacity && <div className={formStyles.errorText}>{fieldErrors.capacity}</div>}
            </div>
          </div>

          {/* Media */}
          <div className={formStyles.formSection}>
            <h3 className={formStyles.sectionTitle}>Event Image</h3>
            <div className={eventStyles.formGroup}>
              <div
                className={`${eventStyles.dropzone} ${dragOver ? eventStyles.dropzoneActive : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className={eventStyles.dropzoneInput}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
                {imagePreview ? (
                  <div className={eventStyles.dropzonePreview}>
                    <img src={imagePreview} alt="Preview" className={eventStyles.dropzonePreviewImg} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{imageFile?.name || 'Current image'}</span>
                      <button
                        type="button"
                        className={eventStyles.iconBtn}
                        style={{ color: 'var(--error)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileChange(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      ><Trash2 size={15} /></button>
                    </div>
                  </div>
                ) : (
                  <div className={eventStyles.dropzonePlaceholder}>
                    <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
                    <div>Click or drag an image here</div>
                    <div style={{ fontSize: '0.75rem' }}>JPG, PNG, GIF, WebP up to 5MB</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div className={formStyles.formSection}>
            <h3 className={formStyles.sectionTitle}>Reminders</h3>
            <div className={formStyles.field} style={{ gridColumn: '1 / -1' }}>
              <label className={eventStyles.reminderToggle}>
                <input
                  type="checkbox"
                  className={eventStyles.toggle}
                  checked={!!form.reminderConfig?.enabled}
                  onChange={(e) => setForm({ ...form, reminderConfig: { ...form.reminderConfig, enabled: e.target.checked } })}
                />
                <span className={eventStyles.toggleLabel}>Enable reminder</span>
              </label>
            </div>
            {form.reminderConfig?.enabled && (
              <div className={formStyles.field}>
                <label className={formStyles.label}>Send reminder (hours before)</label>
                <input
                  className={`${formStyles.input} ${eventStyles.reminderHours} ${fieldErrors.reminderHours ? formStyles.inputError : ''}`}
                  min="1"
                  type="number"
                  value={form.reminderConfig?.sendBeforeHours || 24}
                  onChange={(e) => { setForm({ ...form, reminderConfig: { ...form.reminderConfig, sendBeforeHours: Number(e.target.value) } }); if (fieldErrors.reminderHours) setFieldErrors({ ...fieldErrors, reminderHours: '' }); }}
                  onBlur={(e) => setFieldErrors({ ...fieldErrors, reminderHours: validateField('reminderHours', e.target.value, form) })}
                />
                {fieldErrors.reminderHours && <div className={formStyles.errorText}>{fieldErrors.reminderHours}</div>}
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className={formStyles.formActions}>
            <Link href="/admin/events" className={formStyles.cancelBtn}>Cancel</Link>
            <button type="submit" className={formStyles.submitBtn} disabled={saving}>
              {saving ? <Loader /> : editingId ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

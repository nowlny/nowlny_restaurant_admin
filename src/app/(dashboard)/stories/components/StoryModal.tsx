import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { StoriesService } from '@/services/api/stories';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  story?: any;
  onSave: () => void;
}

export default function StoryModal({ isOpen, onClose, story, onSave }: StoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ imageUrl: '', caption: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (story) {
      setFormData({
        imageUrl: story.imageUrl || '',
        caption: story.caption || ''
      });
    } else {
      setFormData({ imageUrl: '', caption: '' });
    }
  }, [story, isOpen]);

  if (!isOpen) return null;

  const uploadMediaToCloudinary = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'ml_default');
      formData.append('cloud_name', 'dtm5iglra');

      const cldRes = await fetch(
        `https://api.cloudinary.com/v1_1/dtm5iglra/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const cldData = await cldRes.json();
      if (cldData.secure_url || cldData.url) {
        return cldData.secure_url || cldData.url;
      } else {
        throw new Error(cldData.error?.message || 'Cloudinary upload failed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const uploadedUrl = await uploadMediaToCloudinary(file);
        setFormData(prev => ({ ...prev, imageUrl: uploadedUrl }));
      } catch (err) {
        console.error('Failed to upload file', err);
        alert('Failed to upload media. Please try again.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (story) {
        await StoriesService.updateStory(story.id, formData);
      } else {
        await StoriesService.createStory(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save story', err);
      alert('Failed to save story');
    } finally {
      setLoading(false);
    }
  };

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.includes('/video/upload/');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{story ? 'Edit Story' : 'New Story'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Media (Image or Video) *</label>
            
            {formData.imageUrl ? (
              <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-surface)', position: 'relative' }}>
                {isVideoUrl(formData.imageUrl) ? (
                  <video src={formData.imageUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={formData.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-outline"
                  style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '6px 12px', fontSize: '12px', backgroundColor: 'var(--bg-surface)' }}
                  disabled={isUploading}
                >
                  Change Media
                </button>
              </div>
            ) : (
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                style={{ 
                  width: '100%', height: '150px', borderRadius: '8px', border: '2px dashed var(--border-color)', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: isUploading ? 'default' : 'pointer', backgroundColor: 'var(--bg-surface)'
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" style={{ marginBottom: '8px' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Click to upload Image or Video</span>
                  </>
                )}
              </div>
            )}
            
            <input 
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*,video/mp4,video/quicktime"
              onChange={handleFileChange}
            />
            
            {/* Fallback manual URL input */}
            <div style={{ marginTop: '8px' }}>
              <input 
                type="url" 
                className="form-input" 
                placeholder="Or paste media URL here..."
                value={formData.imageUrl}
                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                disabled={isUploading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Caption</label>
            <textarea 
              className="form-input" 
              rows={3}
              placeholder="Write something..."
              value={formData.caption}
              onChange={e => setFormData({ ...formData, caption: e.target.value })}
            />
          </div>

          <button type="submit" disabled={loading || isUploading || !formData.imageUrl} className="btn-primary" style={{ marginTop: '16px', justifyContent: 'center' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Story'}
          </button>
        </form>
      </div>
    </div>
  );
}

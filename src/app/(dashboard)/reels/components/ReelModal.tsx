import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, Video, Image as ImageIcon } from 'lucide-react';
import { ReelsService } from '@/services/api/reels';

interface ReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  reel?: any;
  onSave: () => void;
}

export default function ReelModal({ isOpen, onClose, reel, onSave }: ReelModalProps) {
  const [loading, setLoading] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  
  const [formData, setFormData] = useState({ 
    videoUrl: '', 
    thumbnailUrl: '',
    caption: '',
    menuItemId: '',
    status: 'active'
  });
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (reel) {
      setFormData({
        videoUrl: reel.videoUrl || '',
        thumbnailUrl: reel.thumbnailUrl || '',
        caption: reel.caption || '',
        menuItemId: reel.menuItemId || '',
        status: reel.status || 'active'
      });
    } else {
      setFormData({ videoUrl: '', thumbnailUrl: '', caption: '', menuItemId: '', status: 'active' });
    }
  }, [reel, isOpen]);

  if (!isOpen) return null;

  const uploadMediaToCloudinary = async (file: File, isVideo: boolean): Promise<string> => {
    const resourceType = isVideo ? 'video' : 'image';
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('upload_preset', 'ml_default');
    uploadFormData.append('cloud_name', 'dtm5iglra');

    const cldRes = await fetch(
      `https://api.cloudinary.com/v1_1/dtm5iglra/${resourceType}/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    const cldData = await cldRes.json();
    if (cldData.secure_url || cldData.url) {
      return cldData.secure_url || cldData.url;
    } else {
      throw new Error(cldData.error?.message || 'Cloudinary upload failed');
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsUploadingVideo(true);
      try {
        const uploadedUrl = await uploadMediaToCloudinary(file, true);
        setFormData(prev => ({ ...prev, videoUrl: uploadedUrl }));
      } catch (err) {
        console.error('Failed to upload video', err);
        alert('Failed to upload video. Please try again.');
      } finally {
        setIsUploadingVideo(false);
      }
    }
  };

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsUploadingThumbnail(true);
      try {
        const uploadedUrl = await uploadMediaToCloudinary(file, false);
        setFormData(prev => ({ ...prev, thumbnailUrl: uploadedUrl }));
      } catch (err) {
        console.error('Failed to upload thumbnail', err);
        alert('Failed to upload thumbnail. Please try again.');
      } finally {
        setIsUploadingThumbnail(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (reel) {
        await ReelsService.updateReel(reel.id, formData);
      } else {
        await ReelsService.createReel(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save reel', err);
      alert('Failed to save reel');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.videoUrl && formData.thumbnailUrl;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0, 0, 0, 0.7)', 
      backdropFilter: 'blur(4px)',
      zIndex: 100, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div 
        className="animate-fade-in"
        style={{ 
          width: '100%', 
          maxWidth: '640px', 
          backgroundColor: 'var(--bg-surface)', 
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '95vh',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'var(--bg-base)'
        }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {reel ? 'Edit Reel' : 'Create New Reel'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              {reel ? 'Update your video and details below.' : 'Upload a short, engaging video to attract customers.'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'var(--bg-elevated)', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--text-secondary)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Media Uploads Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Video Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Video <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                
                {formData.videoUrl ? (
                  <div style={{ 
                    height: '240px', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    backgroundColor: 'var(--bg-elevated)', 
                    position: 'relative',
                    border: '1px solid var(--border-color)'
                  }}>
                    <video src={formData.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    <button 
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        right: '12px', 
                        padding: '8px 16px', 
                        fontSize: '13px', 
                        fontWeight: '600',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        backdropFilter: 'blur(4px)',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
                      disabled={isUploadingVideo}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => !isUploadingVideo && videoInputRef.current?.click()}
                    style={{ 
                      height: '240px', 
                      borderRadius: '16px', 
                      border: '2px dashed var(--accent-light)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      cursor: isUploadingVideo ? 'default' : 'pointer', 
                      backgroundColor: 'var(--bg-elevated)',
                      transition: 'all 0.2s ease',
                      gap: '12px'
                    }}
                    onMouseEnter={e => { if (!isUploadingVideo) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                    onMouseLeave={e => { if (!isUploadingVideo) e.currentTarget.style.borderColor = 'var(--accent-light)'; }}
                  >
                    {isUploadingVideo ? (
                      <>
                        <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <div style={{ 
                          width: '56px', height: '56px', borderRadius: '50%', 
                          backgroundColor: 'var(--accent-light)', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center' 
                        }}>
                          <Video size={28} color="var(--accent-primary)" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ display: 'block', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>Click to upload</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>MP4, MOV, WEBM</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <input 
                  type="file"
                  ref={videoInputRef}
                  style={{ display: 'none' }}
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleVideoChange}
                />
              </div>

              {/* Thumbnail Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Thumbnail <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                
                {formData.thumbnailUrl ? (
                  <div style={{ 
                    height: '240px', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    backgroundColor: 'var(--bg-elevated)', 
                    position: 'relative',
                    border: '1px solid var(--border-color)'
                  }}>
                    <img src={formData.thumbnailUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    <button 
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        right: '12px', 
                        padding: '8px 16px', 
                        fontSize: '13px', 
                        fontWeight: '600',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        backdropFilter: 'blur(4px)',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)'}
                      disabled={isUploadingThumbnail}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => !isUploadingThumbnail && thumbnailInputRef.current?.click()}
                    style={{ 
                      height: '240px', 
                      borderRadius: '16px', 
                      border: '2px dashed var(--accent-light)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      cursor: isUploadingThumbnail ? 'default' : 'pointer', 
                      backgroundColor: 'var(--bg-elevated)',
                      transition: 'all 0.2s ease',
                      gap: '12px'
                    }}
                    onMouseEnter={e => { if (!isUploadingThumbnail) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                    onMouseLeave={e => { if (!isUploadingThumbnail) e.currentTarget.style.borderColor = 'var(--accent-light)'; }}
                  >
                    {isUploadingThumbnail ? (
                      <>
                        <Loader2 className="animate-spin" size={36} color="var(--accent-primary)" />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <div style={{ 
                          width: '56px', height: '56px', borderRadius: '50%', 
                          backgroundColor: 'var(--accent-light)', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center' 
                        }}>
                          <ImageIcon size={28} color="var(--accent-primary)" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ display: 'block', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>Click to upload</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>JPG, PNG</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <input 
                  type="file"
                  ref={thumbnailInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleThumbnailChange}
                />
              </div>
            </div>

            {/* Details Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Caption
                </label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  placeholder="Write an engaging caption..."
                  value={formData.caption}
                  onChange={e => setFormData({ ...formData, caption: e.target.value })}
                  style={{ 
                    width: '100%', 
                    borderRadius: '12px', 
                    padding: '16px',
                    fontSize: '15px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    resize: 'none'
                  }}
                />
              </div>

              {reel && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Status
                  </label>
                  <select 
                    className="form-input"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    style={{ 
                      width: '100%', 
                      borderRadius: '12px', 
                      padding: '14px 16px',
                      fontSize: '15px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      appearance: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="active">🟢 Active</option>
                    <option value="hidden">🔴 Hidden</option>
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={onClose} 
                className="btn-outline" 
                style={{ flex: 1, padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: '600', justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || isUploadingVideo || isUploadingThumbnail || !isFormValid} 
                className="btn-primary" 
                style={{ 
                  flex: 2, 
                  padding: '16px', 
                  borderRadius: '12px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  justifyContent: 'center',
                  opacity: (!isFormValid || loading || isUploadingVideo || isUploadingThumbnail) ? 0.6 : 1
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={20} /> Saving Reel...
                  </span>
                ) : (
                  'Publish Reel'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

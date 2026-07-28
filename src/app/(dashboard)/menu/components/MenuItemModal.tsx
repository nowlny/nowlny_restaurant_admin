import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MenuService } from '@/services/api/menu';
import { useI18n } from '@/lib/i18n';

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  item?: any; // If editing
  onSave: () => void;
}

export default function MenuItemModal({ isOpen, onClose, sectionId, item, onSave }: MenuItemModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discountedPrice: 0,
    image: '',
    isActive: true,
    isAvailable: true,
    isPopular: false
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        price: item.price || 0,
        discountedPrice: item.discountedPrice || 0,
        image: item.image || '',
        isActive: item.isActive !== false,
        isAvailable: item.isAvailable !== false,
        isPopular: item.isPopular === true
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: 0,
        discountedPrice: 0,
        image: '',
        isActive: true,
        isAvailable: true,
        isPopular: false
      });
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData, sectionId };
      if (item) {
        await MenuService.updateItem(item.id, payload);
      } else {
        await MenuService.createItem(payload);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save menu item', error);
      alert(t('item.save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{item ? t('item.edit_title') : t('item.add_title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t('item.name')} *</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t('item.description')}</label>
            <textarea 
              className="form-input" 
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t('item.price')} *</label>
              <input 
                required 
                type="number" 
                step="0.01"
                className="form-input" 
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t('item.discounted_price')}</label>
              <input 
                type="number" 
                step="0.01"
                className="form-input" 
                value={formData.discountedPrice}
                onChange={e => setFormData({ ...formData, discountedPrice: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>{t('item.image_url')}</label>
            <input 
              type="url" 
              className="form-input" 
              value={formData.image}
              onChange={e => setFormData({ ...formData, image: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              />
              {t('item.active')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={formData.isAvailable}
                onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })}
              />
              {t('item.available')}
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '16px', justifyContent: 'center' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('item.save')}
          </button>
        </form>
      </div>
    </div>
  );
}

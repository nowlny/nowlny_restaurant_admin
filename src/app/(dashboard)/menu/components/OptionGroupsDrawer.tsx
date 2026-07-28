import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Edit2, Trash2 } from 'lucide-react';
import { MenuService } from '@/services/api/menu';
import { useI18n } from '@/lib/i18n';

interface OptionGroupsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

export default function OptionGroupsDrawer({ isOpen, onClose, itemId, itemName }: OptionGroupsDrawerProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);

  // State for new/edit group
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ name: '', type: 'radio', isRequired: false });
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);

  // State for new/edit option
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<any>(null);
  const [optionForm, setOptionForm] = useState({ name: '', price: 0 });
  const [isOptionFormOpen, setIsOptionFormOpen] = useState(false);

  useEffect(() => {
    if (isOpen && itemId) {
      fetchGroups();
    }
  }, [isOpen, itemId]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await MenuService.getOptionGroupsByItem(itemId);
      setGroups(data);
    } catch (err) {
      console.error('Failed to fetch option groups', err);
    } finally {
      setLoading(false);
    }
  };

  const saveGroup = async () => {
    try {
      if (editingGroup) {
        await MenuService.updateOptionGroup(editingGroup.id, groupForm);
      } else {
        await MenuService.createOptionGroup({ ...groupForm, menuItemId: itemId });
      }
      setIsGroupFormOpen(false);
      setEditingGroup(null);
      fetchGroups();
    } catch (err) {
      console.error('Failed to save group', err);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (confirm(t('options.confirm_delete_group'))) {
      try {
        await MenuService.deleteOptionGroup(groupId);
        fetchGroups();
      } catch (err) {
        console.error('Failed to delete group', err);
      }
    }
  };

  const saveOption = async () => {
    if (!activeGroupId) return;
    try {
      if (editingOption) {
        await MenuService.updateOption(editingOption.id, optionForm);
      } else {
        await MenuService.addOptionToGroup(activeGroupId, optionForm);
      }
      setIsOptionFormOpen(false);
      setEditingOption(null);
      fetchGroups(); // Refresh to get nested options
    } catch (err) {
      console.error('Failed to save option', err);
    }
  };

  const deleteOption = async (optionId: string) => {
    if (confirm(t('options.confirm_delete_option'))) {
      try {
        await MenuService.deleteOption(optionId);
        fetchGroups();
      } catch (err) {
        console.error('Failed to delete option', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }}
      />
      
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, insetInlineEnd: 0, bottom: 0, width: '100%', maxWidth: '400px',
        backgroundColor: 'var(--bg-surface)', zIndex: 50, boxShadow: '0 0 24px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 2 }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{t('options.title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{t('options.for_item', { name: itemName })}</p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1 }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', marginBottom: '24px' }}
            onClick={() => {
              setEditingGroup(null);
              setGroupForm({ name: '', type: 'radio', isRequired: false });
              setIsGroupFormOpen(true);
            }}
          >
            <Plus size={18} /> {t('options.add_group')}
          </button>

          {isGroupFormOpen && (
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', backgroundColor: 'var(--bg-elevated)' }}>
              <h4 style={{ marginBottom: '12px', fontWeight: '600' }}>{editingGroup ? t('options.edit_group') : t('options.new_group')}</h4>
              <input 
                type="text" className="form-input" placeholder={t('options.group_name_placeholder')} 
                value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                style={{ marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <select className="form-input" value={groupForm.type} onChange={e => setGroupForm({ ...groupForm, type: e.target.value })}>
                  <option value="radio">{t('options.type_radio')}</option>
                  <option value="checkbox">{t('options.type_checkbox')}</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={groupForm.isRequired} onChange={e => setGroupForm({ ...groupForm, isRequired: e.target.checked })} />
                  {t('options.required')}
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={saveGroup} style={{ flex: 1, justifyContent: 'center' }}>{t('common.save')}</button>
                <button className="btn-outline" onClick={() => setIsGroupFormOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" />
            </div>
          ) : groups.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('options.empty')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {groups.map(group => (
                <div key={group.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontWeight: '600' }}>{group.name}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {group.type === 'radio' ? t('options.type_radio_short') : t('options.type_checkbox_short')} • {group.isRequired ? t('options.required') : t('options.optional')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => {
                        setEditingGroup(group);
                        setGroupForm({ name: group.name, type: group.type, isRequired: group.isRequired });
                        setIsGroupFormOpen(true);
                      }} aria-label={t('options.edit_aria', { name: group.name })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => deleteGroup(group.id)} aria-label={t('options.delete_aria', { name: group.name })} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  
                  <div style={{ padding: '12px 16px' }}>
                    {(group.options || []).map((option: any) => (
                      <div key={option.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed var(--border-color)' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{option.name}</span>
                          {option.price > 0 && <span className="force-ltr" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginInlineStart: '8px' }}>+${option.price}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => {
                            setActiveGroupId(group.id);
                            setEditingOption(option);
                            setOptionForm({ name: option.name, price: option.price });
                            setIsOptionFormOpen(true);
                          }} aria-label={t('options.edit_aria', { name: option.name })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                          <button onClick={() => deleteOption(option.id)} aria-label={t('options.delete_aria', { name: option.name })} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                    
                    {isOptionFormOpen && activeGroupId === group.id ? (
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input type="text" className="form-input" placeholder={t('options.option_name_placeholder')} value={optionForm.name} onChange={e => setOptionForm({ ...optionForm, name: e.target.value })} />
                          <input type="number" className="form-input" placeholder={t('options.price_placeholder')} style={{ width: '80px' }} value={optionForm.price} onChange={e => setOptionForm({ ...optionForm, price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={saveOption}>{t('common.save')}</button>
                          <button className="btn-outline" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setIsOptionFormOpen(false)}>{t('common.cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setActiveGroupId(group.id);
                          setEditingOption(null);
                          setOptionForm({ name: '', price: 0 });
                          setIsOptionFormOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', padding: 0 }}
                      >
                        <Plus size={14} /> {t('options.add_option')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import '../category-manager.css';

const groupLabel = { SPARE_PART: 'Spare part (fixed price)', ACCESSORY: 'Accessory (priced at checkout)' };

export default function CategoryManager({ categories, parts, createCategory, updateCategory, deleteCategory, close }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('ACCESSORY');
  const [saving, setSaving] = useState(false);
  const countByCategory = parts.reduce((counts, part) => { counts[part.category] = (counts[part.category] || 0) + 1; return counts; }, {});
  const sorted = [...categories].sort((a, b) => a.group === b.group ? a.name.localeCompare(b.name) : a.group === 'SPARE_PART' ? -1 : 1);

  const startAdd = () => { setEditingId(null); setName(''); setGroup('ACCESSORY'); setAdding(true); };
  const startEdit = (category) => { setAdding(false); setEditingId(category.id); setName(category.name); setGroup(category.group); };
  const cancel = () => { setAdding(false); setEditingId(null); };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = editingId ? await updateCategory({ id: editingId, name, group }) : await createCategory({ name, group });
    setSaving(false);
    if (saved) cancel();
  };

  return <div className="modal-backdrop"><div className="modal card category-manager">
    <div className="modal-head"><div><p>STOCK CONTROL</p><h2>Manage categories</h2><small>Add or edit the categories staff can choose from when adding inventory.</small></div><button type="button" onClick={close} aria-label="Close">×</button></div>
    <div className="category-list">{sorted.map((category) => <div className="category-row" key={category.id}>
      <div><strong>{category.name}</strong><small>{groupLabel[category.group]} · {countByCategory[category.name] || 0} item{countByCategory[category.name] === 1 ? '' : 's'}</small></div>
      <div className="category-row-actions"><button type="button" onClick={() => startEdit(category)}>✎ Edit</button><button type="button" className="delete" onClick={() => deleteCategory(category.id, category.name)}>♲ Delete</button></div>
    </div>)}</div>
    {(adding || editingId) ? <form className="category-form" onSubmit={submit}>
      <label>Category name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g., Power Banks" required autoFocus /></label>
      <label>Pricing<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="ACCESSORY">Accessory (priced at checkout)</option><option value="SPARE_PART">Spare part (fixed price)</option></select></label>
      <div className="modal-actions"><button type="button" className="outline" onClick={cancel} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : '＋ Add category'}</button></div>
    </form> : <button type="button" className="outline" onClick={startAdd}>＋ Add category</button>}
  </div></div>;
}

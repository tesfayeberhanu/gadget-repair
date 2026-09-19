'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
import '../category-manager.css';

const groupLabel = { SPARE_PART: 'Spare part (fixed price)', ACCESSORY: 'Accessory (priced at checkout)' };

const CategoryManager = forwardRef(function CategoryManager({ categories, parts, createCategory, updateCategory, deleteCategory }, ref) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('ACCESSORY');
  const [saving, setSaving] = useState(false);
  const countByCategory = parts.reduce((counts, part) => { counts[part.category] = (counts[part.category] || 0) + 1; return counts; }, {});
  const sorted = [...categories].sort((a, b) => a.group === b.group ? a.name.localeCompare(b.name) : a.group === 'SPARE_PART' ? -1 : 1);

  useImperativeHandle(ref, () => ({
    openAdd: () => { setEditingId(null); setName(''); setGroup('ACCESSORY'); setFormOpen(true); },
  }));

  const startEdit = (category) => { setEditingId(category.id); setName(category.name); setGroup(category.group); setFormOpen(true); };
  const cancel = () => { setFormOpen(false); setEditingId(null); };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = editingId ? await updateCategory({ id: editingId, name, group }) : await createCategory({ name, group });
    setSaving(false);
    if (saved) cancel();
  };

  return <section className="card table-card full-table category-manager-inline">
    <div className="panel-title"><div><h2>☷ &nbsp; Categories</h2><p>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · shown when adding an inventory item</p></div></div>
    <div className="category-list">{sorted.map((category) => <div className="category-row" key={category.id}>
      <div><strong>{category.name}</strong><small>{groupLabel[category.group]} · {countByCategory[category.name] || 0} item{countByCategory[category.name] === 1 ? '' : 's'}</small></div>
      <div className="category-row-actions"><button type="button" onClick={() => startEdit(category)}>✎ Edit</button><button type="button" className="delete" onClick={() => deleteCategory(category.id, category.name)}>♲ Delete</button></div>
    </div>)}</div>
    {formOpen && <form className="category-form" onSubmit={submit}>
      <label>Category name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g., Power Banks" required autoFocus /></label>
      <label>Pricing<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="ACCESSORY">Accessory (priced at checkout)</option><option value="SPARE_PART">Spare part (fixed price)</option></select></label>
      <div className="modal-actions"><button type="button" className="outline" onClick={cancel} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : '＋ Add category'}</button></div>
    </form>}
  </section>;
});

export default CategoryManager;

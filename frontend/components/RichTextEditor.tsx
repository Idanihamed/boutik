'use client';

import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

/**
 * Éditeur visuel pour le contenu des Pages et Actualités, à la place d'un champ HTML tapé à la
 * main. Configuré pour ne produire QUE les balises que sanitize-html.util.ts autorise côté
 * serveur (voir sa liste ALLOWED_TAGS) : titres limités à H2/H3 (pas de H1, réservé au titre de
 * la page elle-même), pas de bloc de code, de citation en ligne, de séparateur horizontal, etc.
 * Le serveur assainit de toute façon le HTML à l'enregistrement — cette configuration évite
 * seulement à l'utilisateur de mettre en forme quelque chose qui serait silencieusement retiré.
 */

type ToolbarAction = {
  label: string;
  title: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const ACTIONS: ToolbarAction[] = [
  { label: 'Gras', title: 'Gras', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'Italique', title: 'Italique', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'Souligné', title: 'Souligné', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'Titre 2', title: 'Titre', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Titre 3', title: 'Sous-titre', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '• Liste', title: 'Liste à puces', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1. Liste', title: 'Liste numérotée', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '” Citation', title: 'Citation', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
];

function ToolbarButton({ action, editor }: { action: ToolbarAction; editor: Editor }) {
  const active = action.isActive(editor);
  return (
    <button
      type="button"
      title={action.title}
      onClick={() => action.run(editor)}
      className={`min-h-[36px] rounded-md px-2.5 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {action.label}
    </button>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const active = editor.isActive('link');
  function toggleLink() {
    if (active) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Adresse du lien (https://…)', previous ?? 'https://');
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      window.alert('Le lien doit commencer par http://, https:// ou mailto:.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
  return (
    <button
      type="button"
      title={active ? 'Retirer le lien' : 'Ajouter un lien'}
      onClick={toggleLink}
      className={`min-h-[36px] rounded-md px-2.5 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      🔗 Lien
    </button>
  );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Retirés : aucune balise correspondante dans sanitize-html.util.ts (voir le commentaire
        // en tête de fichier) — les proposer ferait perdre silencieusement la mise en forme.
        strike: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[240px] max-w-none px-3.5 py-3 text-base focus:outline-none prose-content',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Resynchronise l'éditeur si `value` change depuis l'extérieur (ex. chargement d'un article
  // existant une fois l'éditeur déjà monté) — sans cette garde, taper dedans réinitialiserait le
  // curseur à chaque frappe puisque `content` n'est lu qu'au montage par TipTap.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[280px] rounded-xl border-[1.5px] border-slate-300 bg-slate-50" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-slate-300 bg-white focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/30">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1.5">
        {ACTIONS.map((action) => (
          <ToolbarButton key={action.label} action={action} editor={editor} />
        ))}
        <LinkButton editor={editor} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

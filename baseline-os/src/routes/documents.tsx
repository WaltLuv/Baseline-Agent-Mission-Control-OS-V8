/**
 * Documents — V2.3 Hermes Documents Gallery.
 *
 * Mounts the full HermesDocumentsGallery component:
 *   · per-file-type engraved Hermes art
 *   · search · recency grouping · preview · soft-delete to .trash/ · Undo
 *   · install-prompt modal
 *
 * Backend: /__hermes_documents (GET list · GET /file?name= · DELETE ?name=)
 */
import { createFileRoute } from "@tanstack/react-router";
import { HermesDocumentsGallery } from "@/components/hermes-documents-gallery";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Baseline Automations" },
      { name: "description", content: "Visual gallery of every artifact your Hermes agent saves to ~/Documents/Hermes." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 56px)" }}>
      <HermesDocumentsGallery />
    </div>
  );
}

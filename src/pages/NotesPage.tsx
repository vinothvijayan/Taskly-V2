// src/pages/NotesPage.tsx
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Pencil, Save, Trash2, Download, Link as LinkIcon, ExternalLink } from "lucide-react" 
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { signInWithMicrosoftForNotes } from "@/lib/microsoftauth"
import DOMPurify from 'dompurify'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

interface Note {
  id: string
  title: string
  content: string
  type: "text" | "onenote"
  createdAt: string
  updatedAt: string
  contentUrl?: string
  webUrl?: string
}

export default function NotesPage() {
  const { toast } = useToast()
  const [msUser, setMsUser] = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem("mindmeld-notes")
    return saved ? JSON.parse(saved) : []
  })
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [newNoteTitle, setNewNoteTitle] = useState("")
  const [textContent, setTextContent] = useState("")
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const connectMicrosoft = async () => {
    try {
      const token = await signInWithMicrosoftForNotes()
      setAccessToken(token)
      setMsUser({ displayName: "Microsoft Account" })
      toast({
        title: "Microsoft Connected",
        description: "You can now import OneNote pages."
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Connection failed",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  const importOneNotePages = async () => {
    if (!accessToken) {
      toast({ title: "Not connected", description: "Connect Microsoft first.", variant: "destructive" });
      return
    }
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me/onenote/pages", {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const data = await res.json()
      if (!data.value) throw new Error("No OneNote pages found.")
      const importedNotes: Note[] = data.value.map((page: any) => ({
        id: page.id,
        title: page.title || "Untitled Page",
        content: "", 
        contentUrl: page.contentUrl, 
        webUrl: page.links?.oneNoteWebUrl?.href, 
        type: "onenote",
        createdAt: new Date(page.createdDateTime).toISOString(),
        updatedAt: new Date(page.lastModifiedDateTime).toISOString()
      }))
      const updatedNotes = [...importedNotes, ...notes.filter(n => n.type !== 'onenote')]
      saveNotesToStorage(updatedNotes);
      toast({
        title: "OneNote imported",
        description: `${importedNotes.length} pages added from OneNote.`
      })
    } catch (err: any) {
      console.error(err)
      toast({ title: "Import failed", description: err.message, variant: "destructive" })
    }
  }

  const saveNotesToStorage = (updatedNotes: Note[]) => {
    localStorage.setItem("mindmeld-notes", JSON.stringify(updatedNotes))
    setNotes(updatedNotes)
  }

  const createNewNote = () => {
    if (!newNoteTitle.trim()) {
      toast({ title: "Title required", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    const newNote: Note = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: "",
      type: "text",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedNotes = [newNote, ...notes];
    saveNotesToStorage(updatedNotes);
    setActiveNote(newNote);
    setNewNoteTitle("");
    setTextContent("");
    toast({ title: "Note created", description: "Your new note has been created successfully." });
  }

  const saveCurrentNote = async () => {
    if (!activeNote) return;
    const updatedNote: Note = { ...activeNote, content: textContent, updatedAt: new Date().toISOString() };
    const updatedNotes = notes.map(note => note.id === activeNote.id ? updatedNote : note);
    saveNotesToStorage(updatedNotes);
    setActiveNote(updatedNote);
    toast({ title: "Note saved", description: "Your note has been saved successfully." });
  }

  const selectNote = async (note: Note) => {
    setActiveNote(note);
    if (note.type === 'text') {
      setTextContent(note.content);
      setIsLoadingContent(false);
    } else if (note.type === "onenote" && note.contentUrl && accessToken) {
      setIsLoadingContent(true);
      setTextContent('');
      try {
        const res = await fetch(note.contentUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error("Failed to fetch OneNote content.");
        const htmlContent = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");

        const imagePlaceholders = Array.from(doc.querySelectorAll('img[src^="https://graph.microsoft.com"]'));
        
        const imageFetchPromises = imagePlaceholders.map(async (imgElement) => {
          const apiUrl = imgElement.getAttribute('src');
          if (!apiUrl) return;
          const imageRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!imageRes.ok) return;
          const imageBlob = await imageRes.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              (imgElement as HTMLImageElement).src = reader.result as string; // Cast to HTMLImageElement
              resolve(true);
            };
            reader.readAsDataURL(imageBlob);
          });
        });

        await Promise.all(imageFetchPromises);

        doc.body.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
        const finalHtml = doc.body.innerHTML;

        // 👇 THIS IS THE CRITICAL FIX 👇
        // We tell DOMPurify to explicitly allow <img> tags, which will preserve our data URLs.
        const sanitizedHtml = DOMPurify.sanitize(doc.body.innerHTML, { ADD_TAGS: ["img"] });
        setTextContent(sanitizedHtml); // Changed setHtmlPreview to setTextContent
        
      } catch (err: any) {
        console.error(err);
        setTextContent('<p class="text-red-500">Could not load note preview.</p>');
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoadingContent(false);
      }
    } else {
      setTextContent("Preview not available for this note.");
      setIsLoadingContent(false);
    }
  };

  const deleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId)
    saveNotesToStorage(updatedNotes)
    if (activeNote?.id === noteId) {
      setActiveNote(null)
      setTextContent("")
    }
    toast({ title: "Note deleted", description: "The note has been removed.", variant: "destructive" })
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Notes</h1><p className="text-muted-foreground">Create, organize, and import notes</p></div>
        <div className="flex items-center gap-4">
          {!msUser ? (<Button onClick={connectMicrosoft} variant="outline"><LinkIcon className="h-4 w-4 mr-2" />Connect Microsoft</Button>) : (<>
            <p className="text-sm text-muted-foreground">Linked: {msUser.displayName}</p>
            <Button onClick={importOneNotePages} variant="focus"><Download className="h-4 w-4 mr-2" />Import OneNote</Button>
          </>)}
        </div>
      </div>
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border h-[calc(100vh-200px)]">
        <ResizablePanel defaultSize={25} minSize={15}>
          <Card className="h-full border-0 rounded-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Pencil className="h-5 w-5" />My Notes</CardTitle>
              <div className="flex gap-2">
                <Input placeholder="Note title..." value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} onKeyPress={(e) => e.key === "Enter" && createNewNote()} className="flex-1"/>
                <Button onClick={createNewNote} size="icon" variant="focus" className="hover-scale"><Plus className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-350px)]">
                <div className="p-4 space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className={cn("p-3 rounded-lg border cursor-pointer transition-smooth hover-scale", activeNote?.id === note.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50")} onClick={() => selectNote(note)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0"><h4 className="font-medium text-sm truncate">{note.title}</h4><p className="text-xs text-muted-foreground mt-1">{new Date(note.updatedAt).toLocaleDateString()}</p></div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{note.type === "onenote" ? "OneNote" : "📝"}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && (<div className="text-center py-8 text-muted-foreground"><Pencil className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No notes yet</p><p className="text-xs">Create or import notes above</p></div>)}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75} minSize={30}>
            {activeNote ? (
              <Card className="h-full border-0 rounded-none shadow-none flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><span>{activeNote.title}</span></CardTitle>
                    {activeNote.type === "text" ? (<Button onClick={saveCurrentNote} variant="focus" size="sm" className="hover-scale"><Save className="h-4 w-4 mr-2" /> Save</Button>) : activeNote.webUrl && (
                      <a href={activeNote.webUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="hover-scale"><ExternalLink className="h-4 w-4 mr-2" /> Open in OneNote</Button>
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6 overflow-auto">
                  {isLoadingContent ? (<p className="text-muted-foreground animate-pulse">Loading note preview...</p>) : activeNote.type === 'text' ? (<Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Write your notes here..." className="h-full w-full resize-none border-0 p-0 bg-transparent focus-visible:ring-0 text-base leading-relaxed"/>) : (
                    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: textContent }} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4"><Pencil className="h-16 w-16 mx-auto text-muted-foreground/50" /><div><h3 className="text-lg font-medium text-muted-foreground">Select a note to start editing</h3><p className="text-sm text-muted-foreground">Choose a note from the sidebar or create/import one</p></div></div>
              </div>
            )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
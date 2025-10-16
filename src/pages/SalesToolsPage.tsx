import { useState } from 'react';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Mail, Loader2, Download, Upload, Building, Wrench } from "lucide-react";
import * as XLSX from 'xlsx';

// Google Business Extractor Component
const GoogleBusinessExtractor = () => {
  const [location, setLocation] = useState('');
  const [placeType, setPlaceType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!location || !placeType) {
      toast.error("Location and Place Type are required.");
      return;
    }
    setIsLoading(true);
    setResults([]);
    try {
      const extractData = httpsCallable(functions, 'extract_google_business_data');
      const response: any = await extractData({ location, placeType, keyword });
      setResults(response.data.data);
      toast.success(`Found ${response.data.data.length} businesses!`);
    } catch (error: any) {
      console.error("Error fetching business data:", error);
      toast.error("Failed to fetch data", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (results.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Businesses");
    XLSX.writeFile(workbook, "google_business_export.xlsx");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Google Business Extractor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input id="location" placeholder="e.g., Chennai" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeType">Place Type *</Label>
            <Input id="placeType" placeholder="e.g., restaurant" value={placeType} onChange={(e) => setPlaceType(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">Keyword (Optional)</Label>
            <Input id="keyword" placeholder="e.g., biryani" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isLoading ? "Searching..." : "Search"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={results.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export to Excel
          </Button>
        </div>
        <ScrollArea className="h-96 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Website</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.phone}</TableCell>
                  <TableCell>{item.address}</TableCell>
                  <TableCell><a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{item.website}</a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {results.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">No results to display.</div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Email Extractor Component
const EmailExtractor = () => {
  const [results, setResults] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const urlColumnIndex = json[0].findIndex((header: string) => header.toLowerCase().includes('website'));
      if (urlColumnIndex === -1) {
        toast.error("Excel file must have a column with 'Website' in the header.");
        return;
      }

      const urls = json.slice(1).map(row => row[urlColumnIndex]).filter(Boolean);
      if (urls.length > 0) {
        await extractEmails(urls);
      } else {
        toast.info("No URLs found in the selected file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const extractEmails = async (urls: string[]) => {
    setIsLoading(true);
    setResults({});
    try {
      const extractEmailsFn = httpsCallable(functions, 'extract_emails_from_urls');
      const response: any = await extractEmailsFn({ urls });
      setResults(response.data.data);
      toast.success(`Extraction complete for ${urls.length} URLs.`);
    } catch (error: any) {
      console.error("Error extracting emails:", error);
      toast.error("Failed to extract emails", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (Object.keys(results).length === 0) {
      toast.info("No data to export.");
      return;
    }
    const dataToExport = Object.entries(results).map(([url, emails]) => ({
      'Website URL': url,
      'Emails': emails.join(', '),
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Emails");
    XLSX.writeFile(workbook, "email_export.xlsx");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Extractor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="file-upload">Upload Excel File</Label>
          <Input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
          <p className="text-xs text-muted-foreground">
            Your Excel file must contain a column with the header "Website URL".
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={Object.keys(results).length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export to Excel
        </Button>
        <ScrollArea className="h-96 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website URL</TableHead>
                <TableHead>Extracted Emails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(results).map(([url, emails]) => (
                <TableRow key={url}>
                  <TableCell className="font-medium">{url}</TableCell>
                  <TableCell>{emails.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {Object.keys(results).length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">Upload a file to see results.</div>
          )}
          {isLoading && (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const SalesToolsPage = () => {
  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wrench className="h-8 w-8 text-primary" />
          Sales Tools
        </h1>
        <p className="text-muted-foreground">
          Powerful tools to extract business leads and contact information.
        </p>
      </div>
      <Tabs defaultValue="google-business" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="google-business">Google Business Extractor</TabsTrigger>
          <TabsTrigger value="email-extractor">Email Extractor</TabsTrigger>
        </TabsList>
        <TabsContent value="google-business" className="mt-6">
          <GoogleBusinessExtractor />
        </TabsContent>
        <TabsContent value="email-extractor" className="mt-6">
          <EmailExtractor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesToolsPage;
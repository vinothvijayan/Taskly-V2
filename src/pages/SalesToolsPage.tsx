import { useState } from 'react';
import { getFunctions, httpsCallable } from "firebase/functions"; // <-- 1. Import Firebase SDK
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Loader2, Download, Building, Wrench } from "lucide-react";
import * as XLSX from 'xlsx';

// --- No API Key Needed Here! It's securely on the backend. ---

// Initialize Firebase Functions and get a reference to the function
const functions = getFunctions();
const getGoogleBusinessData = httpsCallable(functions, 'get_google_business_data');


const GoogleBusinessExtractor = () => {
  const [location, setLocation] = useState('');
  const [placeType, setPlaceType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- All the old API calling functions (callApi, getLatLng, etc.) can be deleted ---

  const handleSearch = async () => {
    if (!location || !placeType) {
      toast.error("Location and Place Type are required.");
      return;
    }
    setIsLoading(true);
    setResults([]);

    try {
      // 2. Call your Firebase Function securely
      const result: any = await getGoogleBusinessData({ location, placeType, keyword });

      // The data you return from Python is in result.data
      const responseData = result.data;

      if (responseData.status === 'success') {
        setResults(responseData.data);
        toast.success(`Found ${responseData.data.length} businesses!`);
      } else {
        // This 'else' block is for custom error statuses, not usually needed with HttpsError
        throw new Error(responseData.message || "An unknown error occurred on the server.");
      }

    } catch (error: any) {
      console.error("Error fetching business data:", error);
      // The Firebase SDK automatically parses the HttpsError message
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


// The rest of your component remains the same
const SalesToolsPage = () => {
  return (
    <div className="container max-w-7xl mx-auto p-6">
       {/* ... rest of your component ... */}
      <GoogleBusinessExtractor />
    </div>
  );
};

export default SalesToolsPage;
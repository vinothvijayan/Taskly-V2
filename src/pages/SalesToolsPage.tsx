// src/pages/SalesToolsPage.tsx (or wherever your file is located)

import { useState } from 'react';
import { getFunctions, httpsCallable } from "firebase/functions"; // <-- Import Firebase SDK
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Loader2, Download, Building, Wrench } from "lucide-react";
import * as XLSX from 'xlsx';

// --- SECURITY NOTE: The API key has been correctly moved to the backend. ---
// --- It should NOT be present in this frontend file. ---

// Initialize Firebase Functions and get a reference to your callable function
const functions = getFunctions();
const getGoogleBusinessData = httpsCallable(functions, 'get_google_business_data');

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
      // Securely call the backend Firebase Function with the required parameters
      const result: any = await getGoogleBusinessData({ 
        location, 
        placeType, 
        keyword 
      });

      // The data you returned from your Python function is in the `data` property
      const responseData = result.data;

      if (responseData.status === 'success') {
        setResults(responseData.data);
        toast.success(`Found ${responseData.data.length} businesses!`);
      } else {
        // This case is unlikely if the backend always uses HttpsError for failures
        throw new Error(responseData.message || "An unknown server error occurred.");
      }

    } catch (error: any) {
      // The Firebase SDK automatically parses the HttpsError message from your backend
      console.error("Error fetching business data:", error);
      toast.error("Failed to fetch data", { 
        description: error.message || "An unexpected error occurred. Check the console for details." 
      });
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
                  <TableCell>
                    {item.website && item.website !== "N/A" ? (
                      <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {item.website}
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && results.length === 0 && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              No results to display. Enter a search to begin.
            </div>
          )}
           {isLoading && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Fetching data...
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Main page component
const SalesToolsPage = () => {
  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wrench className="h-8 w-8 text-primary" />
          Sales Tools
        </h1>
        <p className="text-muted-foreground">
          Powerful tools to extract business leads and contact information.
        </p>
      </div>
      <GoogleBusinessExtractor />
    </div>
  );
};

export default SalesToolsPage;
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Loader2, Download, Building, Wrench } from "lucide-react";
import * as XLSX from 'xlsx';
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

// This is the name of the Firebase Function we will call
const callProxy = httpsCallable(functions, 'sales_tools_proxy');

// Google Business Extractor Component
const GoogleBusinessExtractor = () => {
  const [location, setLocation] = useState('');
  const [placeType, setPlaceType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const callApi = async (endpoint: string, body: object) => {
    try {
      const response = await callProxy({ endpoint, body });
      return response.data;
    } catch (error: any) {
      console.error(`Error calling proxy for ${endpoint}:`, error);
      const errorMessage = error.details?.message || error.message || "An unknown error occurred.";
      throw new Error(errorMessage);
    }
  };

  const getLatLngFromLocation = async (locationName: string) => {
    const data: any = await callApi('/api/geocode', { locationName });
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return `${location.lat},${location.lng}`;
    }
    return null;
  };

  const getNearbyPlaces = async (location: string, radius: number, type: string, keyword?: string) => {
    let allPlaces: any[] = [];
    let nextPageToken: string | null = null;

    do {
      const body: any = { location, radius, type };
      if (keyword) body.keyword = keyword;
      if (nextPageToken) body.pagetoken = nextPageToken;

      const data: any = await callApi('/api/nearbysearch', body);
      
      if (data.results) {
        allPlaces.push(...data.results);
      }
      
      nextPageToken = data.next_page_token || null;
      
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } while (nextPageToken);

    return allPlaces;
  };

  const getPlaceDetails = async (placeId: string) => {
    const data: any = await callApi('/api/placedetails', { placeId });
    return data.result || {};
  };

  const handleSearch = async () => {
    if (!location || !placeType) {
      toast.error("Location and Place Type are required.");
      return;
    }
    setIsLoading(true);
    setResults([]);
    try {
      const latLng = await getLatLngFromLocation(location);
      if (!latLng) {
        throw new Error(`Could not find coordinates for location: ${location}`);
      }

      const places = await getNearbyPlaces(latLng, 10000, placeType, keyword);
      const uniquePlaces = Array.from(new Map(places.map(p => [p.place_id, p])).values());
      
      const detailedResults = await Promise.all(
        uniquePlaces.map(place => getPlaceDetails(place.place_id))
      );

      const finalResults = detailedResults.map(details => ({
        name: details.name || "N/A",
        address: details.vicinity || "N/A",
        phone: details.formatted_phone_number || "N/A",
        website: details.website || "N/A",
        google_url: details.url || "N/A",
      }));

      setResults(finalResults);
      toast.success(`Found ${finalResults.length} businesses!`);
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
      <GoogleBusinessExtractor />
    </div>
  );
};

export default SalesToolsPage;
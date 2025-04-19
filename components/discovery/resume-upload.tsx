"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { trackEvent } from "@/lib/openreplay"

export interface ResumeUploadProps {
  onResumeProcessed?: (resumeUrl: string) => void;
}

export function ResumeUpload({ onResumeProcessed }: ResumeUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Check file type
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF or DOCX file",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setUploadStatus("idle");
      setUploadError(null);

      // Automatically start the upload process
      uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload your resume",
        variant: "destructive",
      });
      return null;
    }

    setUploadStatus("uploading");
    setUploadError(null);

    try {
      // Generate a unique filename to avoid collisions
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage.from("resumes").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // Create a signed URL that expires in 1 year (31536000 seconds)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("resumes")
        .createSignedUrl(filePath, 31536000);

      if (signedUrlError) {
        throw signedUrlError;
      }

      // Save the signed URL to the user's profile
      const resumeUrl = signedUrlData.signedUrl;
      await supabase
        .from("profiles")
        .update({ resume_link: resumeUrl })
        .eq("id", user.id);

      setUploadStatus("success");

      toast({
        title: "Resume uploaded",
        description: "Your resume has been uploaded successfully and is being processed",
      });

      // Track CV upload in OpenReplay
      trackEvent("cv_uploaded", {
        fileType: file.type,
        fileSize: file.size,
      });

      // Notify parent component
      if (onResumeProcessed) {
        onResumeProcessed(resumeUrl);
      }

      return resumeUrl;
    } catch (error: any) {
      // Check if error is because the folder doesn't exist
      if (error.message && error.message.includes("The resource was not found")) {
        try {
          // Create the user folder by uploading a placeholder file and then deleting it
          const placeholderPath = `${user.id}/.placeholder`;
          const placeholderFile = new Blob([""], { type: "text/plain" });

          await supabase.storage.from("resumes").upload(placeholderPath, placeholderFile);

          // Delete the placeholder file
          await supabase.storage.from("resumes").remove([placeholderPath]);

          // Try uploading the actual file again
          return uploadFile(file);
        } catch (folderError) {
          console.error("Error creating folder:", folderError);
          throw folderError;
        }
      }

      const errorMessage = error instanceof Error ? error.message : "Failed to upload resume";
      setUploadStatus("error");
      setUploadError(errorMessage);

      toast({
        title: "Upload failed",
        description: "There was an error uploading your resume. Please try again.",
        variant: "destructive",
      });

      return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cv-upload">Upload Your Resume/CV (PDF or DOCX)</Label>
        <div
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              const file = e.dataTransfer.files[0];

              // Check file size (5MB limit)
              if (file.size > 5 * 1024 * 1024) {
                toast({
                  title: "File too large",
                  description: "Please select a file smaller than 5MB",
                  variant: "destructive",
                });
                return;
              }

              // Check file type
              const validTypes = [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ];
              if (!validTypes.includes(file.type)) {
                toast({
                  title: "Invalid file type",
                  description: "Please select a PDF or DOCX file",
                  variant: "destructive",
                });
                return;
              }

              setSelectedFile(file);
              setUploadStatus("idle");
              setUploadError(null);

              // Automatically start the upload process
              uploadFile(file);
            }
          }}
        >
          {uploadStatus === "success" ? (
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mb-4" />
              <p className="text-green-600 font-medium">Resume uploaded successfully!</p>
              <p className="text-sm text-gray-500 mt-2">{selectedFile?.name || "Your resume is saved"}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSelectedFile(null);
                  setUploadStatus("idle");
                }}
              >
                Upload a different file
              </Button>
            </div>
          ) : uploadStatus === "error" ? (
            <div className="flex flex-col items-center">
              <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
              <p className="text-red-600 font-medium">Upload failed</p>
              <p className="text-sm text-gray-500 mt-2">{uploadError}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setUploadStatus("idle");
                  setUploadError(null);
                }}
              >
                Try again
              </Button>
            </div>
          ) : uploadStatus === "uploading" ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-primary font-medium">Uploading...</p>
              <p className="text-sm text-gray-500 mt-2">{selectedFile?.name}</p>
            </div>
          ) : selectedFile ? (
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-600 mb-2">Selected file: {selectedFile.name}</p>
              {uploadStatus === "idle" && (
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    onClick={() => uploadFile(selectedFile)}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Upload File
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSelectedFile(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">Drag and drop your resume here, or click to browse</p>
              <p className="text-xs text-gray-500 mb-4">Supports PDF, DOCX (Max 5MB)</p>

              <input
                id="cv-upload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" onClick={() => document.getElementById("cv-upload")?.click()}>
                Browse Files
              </Button>
            </>
          )}
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        <p>Your resume will be analyzed to enhance your role recommendations. We'll extract your skills, experience,
        and education to provide more personalized career suggestions.</p>
      </div>
    </div>
  );
}
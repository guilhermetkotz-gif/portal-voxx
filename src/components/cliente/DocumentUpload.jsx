import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, File, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function DocumentUpload({ files = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files);
    if (fileList.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = fileList.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return {
          url: file_url,
          name: file.name,
          uploaded_at: new Date().toISOString(),
          uploaded_by: (await base44.auth.me())?.email || 'Sistema'
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      onChange([...files, ...uploadedFiles]);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload dos arquivos.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-violet-400 transition-colors">
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-slate-400" />
            )}
            <p className="text-sm text-slate-600">
              {uploading ? 'Enviando arquivos...' : 'Clique para fazer upload ou arraste arquivos'}
            </p>
            <p className="text-xs text-slate-400">
              Contratos, aditivos e outros documentos
            </p>
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Arquivos Anexados:</h4>
          {files.map((file, index) => (
            <Card key={index} className="border-slate-200">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-violet-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{file.name}</p>
                      {file.uploaded_at && (
                        <p className="text-xs text-slate-500">
                          {format(new Date(file.uploaded_at), 'dd/MM/yyyy HH:mm')} • {file.uploaded_by}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 hover:text-violet-700"
                    >
                      Download
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
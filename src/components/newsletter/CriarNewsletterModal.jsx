import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';

export default function CriarNewsletterModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    categoria: 'comunicado',
    segmento: [],
    imagem_url: '',
    publicado: false
  });
  const [imagemTab, setImagemTab] = useState('url');
  const [uploadingImage, setUploadingImage] = useState(false);

  const segmentoOptions = [
    { value: 'oral_sin', label: 'Oral Sin' },
    { value: 'particular', label: 'Particular' },
    { value: 'franquia', label: 'Franquia' },
    { value: 'todos', label: 'Todos' }
  ];

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Newsletter.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
      toast.success('Newsletter criada com sucesso!');
      onOpenChange(false);
      setFormData({
        titulo: '',
        conteudo: '',
        categoria: 'comunicado',
        segmento: [],
        imagem_url: '',
        publicado: false
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar newsletter: ' + error.message);
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, imagem_url: file_url }));
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.conteudo) {
      toast.error('Preencha título e conteúdo');
      return;
    }

    const dataToSubmit = {
      ...formData,
      data_publicacao: formData.publicado ? new Date().toISOString() : undefined
    };

    createMutation.mutate(dataToSubmit);
  };

  const toggleSegmento = (value) => {
    setFormData(prev => ({
      ...prev,
      segmento: prev.segmento.includes(value)
        ? prev.segmento.filter(s => s !== value)
        : [...prev.segmento, value]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Newsletter</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Título da newsletter"
            />
          </div>

          <div className="space-y-2">
            <Label>Conteúdo (Markdown)</Label>
            <Textarea
              value={formData.conteudo}
              onChange={(e) => setFormData(prev => ({ ...prev, conteudo: e.target.value }))}
              placeholder="Use markdown para formatar o conteúdo..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={formData.categoria} onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="otimizacao">Otimização</SelectItem>
                <SelectItem value="boas_praticas">Boas Práticas</SelectItem>
                <SelectItem value="tendencias">Tendências</SelectItem>
                <SelectItem value="comunicado">Comunicado</SelectItem>
                <SelectItem value="novidade">Novidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Segmento de Clientes</Label>
            <div className="space-y-2">
              {segmentoOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={option.value}
                    checked={formData.segmento.includes(option.value)}
                    onCheckedChange={() => toggleSegmento(option.value)}
                  />
                  <Label htmlFor={option.value} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imagem de Capa</Label>
            <Tabs value={imagemTab} onValueChange={setImagemTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  URL da Imagem
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload de Arquivo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-2">
                <Input
                  type="url"
                  value={formData.imagem_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, imagem_url: e.target.value }))}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </TabsContent>

              <TabsContent value="upload" className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="flex-1"
                  />
                  {uploadingImage && <Loader2 className="w-4 h-4 animate-spin text-violet-600" />}
                </div>
                {formData.imagem_url && !uploadingImage && (
                  <div className="mt-2">
                    <img 
                      src={formData.imagem_url} 
                      alt="Preview" 
                      className="w-full h-40 object-cover rounded-lg border border-slate-200"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="publicado"
              checked={formData.publicado}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, publicado: checked }))}
            />
            <Label htmlFor="publicado" className="cursor-pointer">
              Publicar imediatamente
            </Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Newsletter'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
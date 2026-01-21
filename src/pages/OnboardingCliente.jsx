import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import OnboardingInfo from '@/components/onboarding/OnboardingInfo';
import OnboardingAccounts from '@/components/onboarding/OnboardingAccounts';
import OnboardingPlanning from '@/components/onboarding/OnboardingPlanning';
import OnboardingContacts from '@/components/onboarding/OnboardingContacts';
import OnboardingReview from '@/components/onboarding/OnboardingReview';

export default function OnboardingCliente() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get('clienteId');

  const [currentStep, setCurrentStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({
    clienteInfo: {},
    contas: [],
    planejamento: {},
    contatos: {},
  });

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: () => clienteId ? base44.entities.Cliente.filter({ id: clienteId }) : null,
    enabled: !!clienteId,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data) => {
      // Atualizar cliente
      await base44.entities.Cliente.update(clienteId, data.clienteInfo);
      
      // Criar planejamento estratégico se fornecido
      if (data.planejamento && Object.keys(data.planejamento).length > 0) {
        await base44.entities.PlanejamentoEstrategico.create({
          cliente_id: clienteId,
          cliente_nome: data.clienteInfo.nome,
          ...data.planejamento,
        });
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast({
        title: 'Onboarding Completo!',
        description: 'Cliente configurado com sucesso.',
      });
      navigate('/CadastroCliente');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao completar onboarding',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading || !cliente) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p>Carregando cliente...</p>
        </div>
      </div>
    );
  }

  const currentCliente = cliente[0];

  // Definir etapas baseado no tipo de cliente
  const steps = [
    {
      id: 'info',
      title: 'Informações',
      description: 'Validar dados básicos',
      component: OnboardingInfo,
    },
    {
      id: 'accounts',
      title: 'Contas de Anúncio',
      description: 'Configurar contas Meta, Google, TikTok',
      component: OnboardingAccounts,
    },
    {
      id: 'planning',
      title: 'Planejamento Inicial',
      description: 'Definir metas e investimentos',
      component: OnboardingPlanning,
      conditional: currentCliente.status === 'ativo',
    },
    {
      id: 'contacts',
      title: 'Contatos Importantes',
      description: 'Responsáveis do cliente e Voxx',
      component: OnboardingContacts,
    },
    {
      id: 'review',
      title: 'Revisão Final',
      description: 'Confirmar configurações',
      component: OnboardingReview,
    },
  ].filter(step => step.conditional !== false);

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData.component;
  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  const handleNext = (stepData) => {
    setOnboardingData(prev => ({
      ...prev,
      [currentStepData.id === 'info' ? 'clienteInfo' :
       currentStepData.id === 'accounts' ? 'contas' :
       currentStepData.id === 'planning' ? 'planejamento' :
       currentStepData.id === 'contacts' ? 'contatos' : 'review']: stepData,
    }));

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = () => {
    const finalData = {
      clienteInfo: {
        ...currentCliente,
        ...onboardingData.clienteInfo,
        contas_anuncio: onboardingData.contas,
        ...onboardingData.contatos,
      },
      planejamento: onboardingData.planejamento,
    };
    completeOnboardingMutation.mutate(finalData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Bem-vindo ao Onboarding
          </h1>
          <p className="text-slate-600">
            {currentCliente.nome}
          </p>
        </div>

        {/* Progress */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="text-lg">
                  {currentStep + 1}. {currentStepData.title}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {currentStepData.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-violet-600">
                  {currentStep + 1}/{steps.length}
                </div>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </CardHeader>
        </Card>

        {/* Step */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <StepComponent
              cliente={currentCliente}
              data={onboardingData}
              onNext={handleNext}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex gap-2">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full ${
                  idx < currentStep
                    ? 'bg-green-600'
                    : idx === currentStep
                    ? 'bg-violet-600'
                    : 'bg-slate-300'
                }`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => {
                const form = document.querySelector('form');
                if (form) {
                  form.requestSubmit();
                }
              }}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={completeOnboardingMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {completeOnboardingMutation.isPending ? 'Finalizando...' : 'Concluir'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
import { z } from 'zod';
export const cadastroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: z.email('Informe um e-mail válido.'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.').max(72),
});
export const entrarSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
});
export const onboardingNegocioSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do negócio.').max(100),
  slug: z.string().min(3, 'Use pelo menos 3 caracteres.').max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens.'),
  nomeDono: z.string().trim().min(2, 'Informe seu nome.').max(100),
  telefone: z.string().max(25).default(''),
  cidade: z.string().max(100).default(''),
});

import type { ProjectType } from '../types';

export type TerraformTemplateType = 'next' | 'react-mf' | 'streamlit';

export function terraformTemplateType(type: ProjectType): TerraformTemplateType {
  if (type === 'vite') return 'react-mf';
  return type;
}

export function terraformTemplatesSubdir(type: ProjectType): string {
  return type;
}

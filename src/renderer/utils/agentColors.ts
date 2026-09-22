const GRADIENTS: string[] = [
  'linear-gradient(135deg, #E8B79A 0%, #D48C6A 100%)',
  'linear-gradient(135deg, #A8C5B0 0%, #7FA68A 100%)',
  'linear-gradient(135deg, #B8A9D4 0%, #927FBF 100%)',
  'linear-gradient(135deg, #D4B896 0%, #B8956A 100%)',
  'linear-gradient(135deg, #9AB8D4 0%, #6A95C0 100%)',
  'linear-gradient(135deg, #D4A0A0 0%, #B87373 100%)',
  'linear-gradient(135deg, #C5BFA0 0%, #A8A075 100%)',
  'linear-gradient(135deg, #B0A8C5 0%, #8A7FA6 100%)'
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getAgentColorIndex(id: string): number {
  return hashId(id) % GRADIENTS.length;
}

export function getAgentGradient(id: string): string {
  return GRADIENTS[getAgentColorIndex(id)];
}

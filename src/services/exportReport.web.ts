import html2canvas from 'html2canvas';

export const exportReportCard = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const canvas = await html2canvas(element, {
    backgroundColor: '#0A0A0F',
    scale: 2, // high resolution
  });
  
  const link = document.createElement('a');
  link.download = `echo-report-${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

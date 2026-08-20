export const formatCNPJ = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
};

export const formatCPF = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
    .substring(0, 14);
};

export const formatCpfCnpj = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    return formatCPF(digits);
  }
  return formatCNPJ(digits);
};

export const isValidCNPJ = (cnpj: string): boolean => {
  const b = [ 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 ];
  let c: string | number = String(cnpj).replace(/[^\d]/g, '');

  if (c.length !== 14) return false;

  if (/0{14}/.test(c)) return false;

  let n = 0;
  for (let i = 0; i < 12; i++) {
    n += parseInt(c[i]) * b[i + 1];
  }
  // @ts-ignore
  if (c[12] != (((n %= 11) < 2) ? 0 : 11 - n)) return false;

  n = 0;
  for (let i = 0; i <= 12; i++) {
    n += parseInt(c[i]) * b[i];
  }
  // @ts-ignore
  if (c[13] != (((n %= 11) < 2) ? 0 : 11 - n)) return false;

  return true;
};

export const isValidCPF = (cpf: string): boolean => {
  if (typeof cpf !== 'string') return false;
  cpf = cpf.replace(/[\s.-]/g, '');
  if (cpf.length !== 11 || !Array.from(cpf).filter(e => e !== cpf[0]).length) {
    return false;
  }
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) 
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) 
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

export const isValidCpfCnpj = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
};

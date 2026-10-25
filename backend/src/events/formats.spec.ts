import { inferFormat } from './formats';

describe('inferFormat', () => {
  it('reads the format from the name', () => {
    expect(inferFormat('42. RTF Rund um den Kahlen Asten')).toBe('rtf');
    expect(inferFormat('Winter-CTF Haltern')).toBe('ctf');
    expect(inferFormat('Radmarathon Tannheimer Tal')).toBe('marathon');
    expect(inferFormat('Brevet 300 km Hamburg')).toBe('brevet');
    expect(inferFormat('Jedermannrennen Rund um Köln')).toBe('jedermann');
    expect(inferFormat('Gravel Ride Odenwald')).toBe('gravel_ride');
  });

  it('says nothing for plain race names', () => {
    expect(inferFormat('Großer Preis von Buir')).toBeNull();
    expect(inferFormat('MTB-Marathon Willingen')).toBeNull();
    expect(inferFormat('Kriterium Sportpark')).toBeNull();
  });
});

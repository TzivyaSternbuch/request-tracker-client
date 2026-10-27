import { initials } from './initials';

describe('initials', () => {
  it('initials_TwoWordName_ReturnsTwoLetters', () => {
    const result = initials('dana katz');

    expect(result).toBe('DK');
  });

  it('initials_ExtraWordsAndSpaces_UsesFirstTwoWords', () => {
    const result = initials('  dana   katz levi ');

    expect(result).toBe('DK');
  });

  it('initials_OneWord_ReturnsOneLetter', () => {
    const result = initials('avi');

    expect(result).toBe('A');
  });

  it('initials_Blank_ReturnsEmpty', () => {
    const result = initials('   ');

    expect(result).toBe('');
  });
});

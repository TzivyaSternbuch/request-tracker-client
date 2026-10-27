import { TestBed } from '@angular/core/testing';
import { ActingAsService } from './acting-as.service';

describe('ActingAsService', () => {
  it('name_Initially_IsEmpty', () => {
    const service = TestBed.inject(ActingAsService);

    expect(service.name()).toBe('');
  });

  it('setName_Text_UpdatesName', () => {
    const service = TestBed.inject(ActingAsService);

    service.setName('Dana Katz');

    expect(service.name()).toBe('Dana Katz');
  });
});

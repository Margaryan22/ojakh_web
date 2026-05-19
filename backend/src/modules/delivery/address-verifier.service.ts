import { BadRequestException, Injectable } from '@nestjs/common';
import { TwoGisService } from './two-gis.service';

export interface VerifyAddressInput {
  address: string;
  lat?: number | null;
  lon?: number | null;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
}

@Injectable()
export class AddressVerifierService {
  constructor(private readonly twoGis: TwoGisService) {}

  async verify(payload: VerifyAddressInput): Promise<void> {
    const info = await this.twoGis.getBuildingInfo({
      lat: payload.lat ?? undefined,
      lon: payload.lon ?? undefined,
      address: payload.address,
    });
    if (!info || !info.knownBuilding) return;

    if (payload.entrance && info.entranceCount != null) {
      const n = parseInt(payload.entrance, 10);
      if (Number.isFinite(n) && (n < 1 || n > info.entranceCount)) {
        throw new BadRequestException(
          `В этом доме ${info.entranceCount} ${this.pluralEntrance(info.entranceCount)} — указан №${n}.`,
        );
      }
    }

    if (payload.floor && info.floorsCount != null) {
      const f = parseInt(payload.floor, 10);
      const minFloor =
        info.floorsUnderground && info.floorsUnderground > 0
          ? -info.floorsUnderground
          : 1;
      if (Number.isFinite(f) && (f < minFloor || f > info.floorsCount)) {
        throw new BadRequestException(
          `Этажность дома — ${info.floorsCount}, указан этаж ${f}.`,
        );
      }
    }

    if (payload.apartment && info.apartmentRanges && info.apartmentRanges.length) {
      const digits = payload.apartment.replace(/[^\d]/g, '');
      if (digits) {
        const aptNum = parseInt(digits, 10);
        if (Number.isFinite(aptNum)) {
          const inRange = info.apartmentRanges.some(
            (r) => aptNum >= r.from && aptNum <= r.to,
          );
          if (!inRange) {
            const ranges = info.apartmentRanges
              .map((r) => `${r.from}–${r.to}`)
              .join(', ');
            throw new BadRequestException(
              `Квартира ${aptNum} вне диапазона дома (${ranges}).`,
            );
          }
        }
      }
    }
  }

  private pluralEntrance(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'подъезд';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'подъезда';
    return 'подъездов';
  }
}

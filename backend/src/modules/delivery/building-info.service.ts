import { Injectable } from '@nestjs/common';
import { BuildingInfo, TwoGisService } from './two-gis.service';
import { DaDataCleanerService } from './dadata-cleaner.service';

export { BuildingInfo } from './two-gis.service';

export interface BuildingInfoQuery {
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/**
 * Фасад над несколькими источниками паспорта дома.
 * Сейчас опрашивает параллельно:
 *   - DaData Clean API (даёт apartmentsCount + изредка floorsCount),
 *   - 2GIS Geocoder (на расширенном ключе даёт porch_count, floors).
 *
 * Если ни один источник не знает дома — возвращает knownBuilding=false,
 * и валидатор работает fail-open (приём любых значений). Это сознательное
 * поведение для новостроек и адресов, отсутствующих в базах.
 */
@Injectable()
export class BuildingInfoService {
  constructor(
    private readonly twoGis: TwoGisService,
    private readonly dadataCleaner: DaDataCleanerService,
  ) {}

  async getBuildingInfo(query: BuildingInfoQuery): Promise<BuildingInfo> {
    const [twoGisInfo, daDataInfo] = await Promise.all([
      this.twoGis.getBuildingInfo({
        address: query.address ?? null,
        lat: query.lat ?? null,
        lon: query.lon ?? null,
      }),
      query.address ? this.dadataCleaner.cleanAddress(query.address) : Promise.resolve(null),
    ]);

    const apartmentsCount = daDataInfo?.apartmentsCount ?? null;
    const apartmentRanges =
      twoGisInfo?.apartmentRanges ??
      (apartmentsCount != null && apartmentsCount > 0
        ? [{ entrance: null, floors: null, from: 1, to: apartmentsCount }]
        : null);

    const floorsCount = twoGisInfo?.floorsCount ?? daDataInfo?.floorsCount ?? null;
    const floorsUnderground = twoGisInfo?.floorsUnderground ?? null;
    const entranceCount = twoGisInfo?.entranceCount ?? null;

    const knownBuilding =
      !!twoGisInfo?.knownBuilding ||
      apartmentRanges != null ||
      floorsCount != null;

    return {
      knownBuilding,
      floorsCount,
      floorsUnderground,
      entranceCount,
      apartmentRanges,
    };
  }
}

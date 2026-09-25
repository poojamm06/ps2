import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { StaticWeighingPoint } from '../types';
import { getMpeForLoad as getMpeForLoadShared } from '../utils/oimlMpe';

interface ObservationGridProps {
  points: StaticWeighingPoint[];
  unit: string;
  maxCapacity: number;
  minCapacity: number;
  verificationScaleInterval_e: number;
  accuracyClass: string;
  onUpdatePoint: (id: string, field: keyof StaticWeighingPoint, value: string) => void;
  onDeletePoint: (id: string) => void;
  onDuplicatePoint: (id: string) => void;
}

const columnHelper = createColumnHelper<StaticWeighingPoint>();

export const ObservationGrid: React.FC<ObservationGridProps> = ({
  points,
  unit,
  maxCapacity,
  minCapacity,
  verificationScaleInterval_e,
  accuracyClass,
  onUpdatePoint,
  onDeletePoint,
  onDuplicatePoint,
}) => {
  // OIML R-76 Table 6 MPE lookup — shared with the Results fallback (utils/oimlMpe.ts)
  const getMpeForLoad = (loadVal: number) =>
    getMpeForLoadShared(loadVal, verificationScaleInterval_e, accuracyClass, unit);

  // Define TanStack Table columns
  const columns = useMemo(
    () => [
      // 1. Point Number
      columnHelper.accessor('pointNumber', {
        header: '#',
        cell: (info) => (
          <div className="flex items-center justify-center font-label-mono-sm text-xs font-bold text-outline py-1">
            {String(info.getValue()).padStart(2, '0')}
          </div>
        ),
        size: 50,
      }),

      // 2. Applied Load (L) - Editable Input
      columnHelper.accessor('appliedLoad', {
        header: () => (
          <div className="flex flex-col items-start">
            <span className="font-bold text-primary">Applied Load (L)</span>
            <span className="text-[10px] text-outline font-mono">Reference [{unit}]</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const val = row.appliedLoad;
          const numVal = parseFloat(val);
          const isOverMax = !isNaN(numVal) && maxCapacity > 0 && numVal > maxCapacity;
          const isUnderMin = !isNaN(numVal) && minCapacity > 0 && numVal < minCapacity && numVal > 0;
          const isInvalidNum = val.trim() !== '' && isNaN(numVal);

          return (
            <div className="space-y-1">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => onUpdatePoint(row.id, 'appliedLoad', e.target.value)}
                  placeholder="--"
                  className={`w-full text-right px-2.5 py-1.5 rounded border metrology-mono text-xs font-semibold focus:outline-none focus:ring-1 transition-colors ${
                    isOverMax || isInvalidNum
                      ? 'border-error bg-error/5 text-error focus:ring-error'
                      : isUnderMin
                      ? 'border-[#F59E0B] bg-[#FEF3C7]/40 text-on-surface focus:ring-[#F59E0B]'
                      : 'border-outline-variant/50 bg-surface-container-lowest text-primary focus:border-secondary focus:ring-secondary'
                  }`}
                />
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-outline pointer-events-none">
                  {val ? unit : ''}
                </span>
              </div>
              {isOverMax && (
                <div className="text-[10px] text-error font-medium flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">warning</span>
                  Exceeds Max ({maxCapacity} {unit})
                </div>
              )}
            </div>
          );
        },
        size: 140,
      }),

      // 3. Indication (I) - Editable Input
      columnHelper.accessor('indication', {
        header: () => (
          <div className="flex flex-col items-start">
            <span className="font-bold text-primary">Indication (I)</span>
            <span className="text-[10px] text-outline font-mono">Display [{unit}]</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const val = row.indication;
          const isInvalidNum = val.trim() !== '' && isNaN(parseFloat(val));

          return (
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={val}
                onChange={(e) => onUpdatePoint(row.id, 'indication', e.target.value)}
                placeholder="--"
                className={`w-full text-right px-2.5 py-1.5 rounded border metrology-mono text-xs font-semibold focus:outline-none focus:ring-1 transition-colors ${
                  isInvalidNum
                    ? 'border-error bg-error/5 text-error focus:ring-error'
                    : 'border-outline-variant/50 bg-surface-container-lowest text-primary focus:border-secondary focus:ring-secondary'
                }`}
              />
            </div>
          );
        },
        size: 130,
      }),

      // 4. Additional Load (ΔL) - Editable Input
      columnHelper.accessor('additionalLoadDeltaL', {
        header: () => (
          <div className="flex flex-col items-start">
            <span className="font-semibold text-on-surface">Additional (ΔL)</span>
            <span className="text-[10px] text-outline font-mono">Small mass [{unit}]</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={row.additionalLoadDeltaL}
                onChange={(e) => onUpdatePoint(row.id, 'additionalLoadDeltaL', e.target.value)}
                placeholder="0.00"
                className="w-full text-right px-2.5 py-1.5 rounded border border-outline-variant/50 bg-surface-container-lowest text-on-surface metrology-mono text-xs focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>
          );
        },
        size: 120,
      }),

      // 5. Prior-Rounding Indication (P) - Calculated Column
      columnHelper.display({
        id: 'priorRoundingP',
        header: () => (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="font-bold text-secondary">P = I+0.5e−ΔL</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-secondary font-mono">CALC</span>
            </div>
            <span className="text-[10px] text-outline font-mono">Clause A.4.4.3</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const ind = parseFloat(row.indication);
          const delta = parseFloat(row.additionalLoadDeltaL) || 0;
          const e = verificationScaleInterval_e > 0 ? verificationScaleInterval_e : 0.1;

          if (row.indication.trim() === '' || isNaN(ind)) {
            return <div className="text-right text-outline text-xs metrology-mono py-1.5">--</div>;
          }

          const P = ind + 0.5 * e - delta;
          return (
            <div className="text-right metrology-mono text-xs font-semibold text-secondary py-1.5 bg-surface-container-low/40 px-2 rounded">
              {P.toFixed(4)}
            </div>
          );
        },
        size: 130,
      }),

      // 6. Raw Error (E) - Calculated Column
      columnHelper.display({
        id: 'rawErrorE',
        header: () => (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="font-bold text-secondary">E = P − L</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-secondary font-mono">CALC</span>
            </div>
            <span className="text-[10px] text-outline font-mono">Clause A.4.4.3</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const ind = parseFloat(row.indication);
          const load = parseFloat(row.appliedLoad);
          const delta = parseFloat(row.additionalLoadDeltaL) || 0;
          const e = verificationScaleInterval_e > 0 ? verificationScaleInterval_e : 0.1;

          if (row.indication.trim() === '' || row.appliedLoad.trim() === '' || isNaN(ind) || isNaN(load)) {
            return <div className="text-right text-outline text-xs metrology-mono py-1.5">--</div>;
          }

          const P = ind + 0.5 * e - delta;
          const E = P - load;
          const isPositive = E > 0;

          return (
            <div className="text-right metrology-mono text-xs font-semibold text-secondary py-1.5 bg-surface-container-low/40 px-2 rounded">
              {isPositive ? `+${E.toFixed(4)}` : E.toFixed(4)}
            </div>
          );
        },
        size: 120,
      }),

      // 7. Zero Error (E0) - Input / Constant
      columnHelper.accessor('zeroErrorE0', {
        header: () => (
          <div className="flex flex-col items-start">
            <span className="font-semibold text-on-surface">Zero Error (E₀)</span>
            <span className="text-[10px] text-outline font-mono">No-load [{unit}]</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={row.zeroErrorE0}
                onChange={(e) => onUpdatePoint(row.id, 'zeroErrorE0', e.target.value)}
                placeholder="0.00"
                className="w-full text-right px-2.5 py-1.5 rounded border border-outline-variant/50 bg-surface-container-lowest text-on-surface metrology-mono text-xs focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>
          );
        },
        size: 110,
      }),

      // 8. Corrected Error (Ec) - Calculated Column
      columnHelper.display({
        id: 'correctedErrorEc',
        header: () => (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="font-bold text-primary">Ec = E − E₀</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-primary/10 text-primary font-mono font-bold">CALC</span>
            </div>
            <span className="text-[10px] text-outline font-mono">Clause A.4.4.3</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const ind = parseFloat(row.indication);
          const load = parseFloat(row.appliedLoad);
          const delta = parseFloat(row.additionalLoadDeltaL) || 0;
          const e0 = parseFloat(row.zeroErrorE0) || 0;
          const e = verificationScaleInterval_e > 0 ? verificationScaleInterval_e : 0.1;

          if (row.indication.trim() === '' || row.appliedLoad.trim() === '' || isNaN(ind) || isNaN(load)) {
            return <div className="text-right text-outline text-xs metrology-mono py-1.5">--</div>;
          }

          const P = ind + 0.5 * e - delta;
          const E = P - load;
          const Ec = E - e0;
          const isPositive = Ec > 0;

          return (
            <div className="text-right metrology-mono text-xs font-bold text-primary py-1.5 bg-primary/5 px-2 rounded">
              {isPositive ? `+${Ec.toFixed(4)}` : Ec.toFixed(4)}
            </div>
          );
        },
        size: 130,
      }),

      // 9. MPE Limit - Derived from OIML R-76 Ruleset
      columnHelper.display({
        id: 'mpeLimit',
        header: () => (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="font-bold text-primary">MPE Limit</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-secondary font-mono">TABLE 6</span>
            </div>
            <span className="text-[10px] text-outline font-mono">m = L / e</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const load = parseFloat(row.appliedLoad);

          if (row.appliedLoad.trim() === '' || isNaN(load)) {
            return <div className="text-right text-outline text-xs metrology-mono py-1.5">--</div>;
          }

          const { limitStr, m, factor } = getMpeForLoad(load);

          return (
            <div className="text-right py-1.5">
              <div className="metrology-mono text-xs font-semibold text-primary">
                {limitStr}
              </div>
              <div className="text-[10px] text-outline font-mono">
                m = {m.toLocaleString()} e [±{factor}e]
              </div>
            </div>
          );
        },
        size: 160,
      }),

      // 10. Point Verdict (Pending Compliance Calculation per spec)
      columnHelper.display({
        id: 'pointVerdict',
        header: () => (
          <div className="flex flex-col items-center">
            <span className="font-bold text-primary">Verdict</span>
            <span className="text-[10px] text-outline font-mono">Point-Level</span>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const ind = parseFloat(row.indication);
          const load = parseFloat(row.appliedLoad);

          if (row.appliedLoad.trim() === '' || row.indication.trim() === '' || isNaN(ind) || isNaN(load)) {
            return (
              <div className="flex justify-center py-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-label-mono-sm font-semibold bg-surface-container text-outline">
                  AWAITING INPUT
                </span>
              </div>
            );
          }

          // Per specification: do NOT falsely hardcode PASS in observation stage
          // Clearly label as Pending Compliance Calculation
          return (
            <div className="flex justify-center py-1.5">
              <span 
                className="px-2.5 py-0.5 rounded text-[11px] font-label-mono-sm font-semibold bg-secondary-fixed/30 text-on-secondary-fixed border border-secondary/20 flex items-center gap-1"
                title="Observations recorded. Final metrological compliance calculation evaluated in Step 3."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                PENDING EVAL
              </span>
            </div>
          );
        },
        size: 140,
      }),

      // 11. Row Actions
      columnHelper.display({
        id: 'actions',
        header: () => <span className="text-outline text-xs">Actions</span>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-center gap-1 py-1">
              <button
                type="button"
                onClick={() => onDuplicatePoint(row.id)}
                title="Duplicate Point"
                className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
              <button
                type="button"
                onClick={() => onDeletePoint(row.id)}
                title="Delete Point"
                className="p-1 rounded text-outline hover:text-error hover:bg-error/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          );
        },
        size: 80,
      }),
    ],
    [unit, maxCapacity, minCapacity, verificationScaleInterval_e, accuracyClass, onUpdatePoint, onDeletePoint, onDuplicatePoint]
  );

  // Initialize TanStack React Table
  const table = useReactTable({
    data: points,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant/40 shadow-card bg-surface-container-lowest">
      <table className="w-full text-left border-collapse">
        {/* Table Header */}
        <thead className="bg-[#F4F2FF] border-b border-outline-variant/40 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="px-3 py-2.5 text-xs font-semibold text-primary select-none whitespace-nowrap"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-outline-variant/30 font-body-sm">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-10 text-on-surface-variant">
                <div className="max-w-md mx-auto space-y-2">
                  <span className="material-symbols-outlined text-[36px] text-outline">scale</span>
                  <p className="font-semibold text-primary">No observation points recorded.</p>
                  <p className="text-xs text-outline">
                    Click <strong>"+ Add Observation"</strong> above to record test load points.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`hover:bg-[#F4F2FF] transition-colors group ${idx % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

import type { TruckPlacement } from './layout';
import { TruckModel } from './models/TruckModel';
import { TRUCK_STATUS_COLOR } from './palette';

export function Trucks({ trucks }: { trucks: TruckPlacement[] }) {
  return (
    <group>
      {trucks.map(({ truck, x, z, rotation }) => (
        <group key={truck.id} position={[x, 0, z]} rotation={[0, rotation, 0]}>
          <TruckModel vehicleClass={truck.vehicleClass} accent={TRUCK_STATUS_COLOR[truck.status]} />
        </group>
      ))}
    </group>
  );
}

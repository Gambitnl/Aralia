import React from 'react';
export interface PickedMonster {
    name: string;
    quantity: number;
    cr: string;
    crLair?: string;
    xpLair?: number;
    isLair?: boolean;
    description: string;
}
interface MonsterPickerProps {
    onAdd: (monster: PickedMonster) => void;
}
declare const MonsterPicker: React.FC<MonsterPickerProps>;
export default MonsterPicker;

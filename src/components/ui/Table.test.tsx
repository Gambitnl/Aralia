import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableHeader,
    TableRow,
} from './Table';

describe('Table Component', () => {
    it('renders the table structure correctly', () => {
        render(
            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Header 1</TableHead>
                            <TableHead>Header 2</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Cell 1</TableCell>
                            <TableCell>Cell 2</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        );

        expect(screen.getByText('Header 1')).toBeInTheDocument();
        expect(screen.getByText('Cell 1')).toBeInTheDocument();
        // Check for specific styling classes to verify theme application
        const buffer = screen.getByText('Header 1');
        expect(buffer.tagName).toBe('TH');
        expect(buffer).toHaveClass('text-amber-300');
    });
});

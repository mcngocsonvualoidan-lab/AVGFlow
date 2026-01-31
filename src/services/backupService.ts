import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { collection, getDocs } from 'firebase/firestore';

export const backupDataToSupabase = async () => {
    try {
        console.log('Starting automated backup to Supabase...');
        const backupTimestamp = new Date().toISOString();

        // 1. Fetch data from all key collections
        const collectionsToBackup = [
            'users',
            'tasks',
            'logs', // Order logs
            'notifications',
            'wishes',
            'events',
            'payroll',
            'meetings',
            'conclusion_docs',
            'conclusion_votes',
            'business_fund_transactions'
        ];

        const allData: Record<string, any[]> = {};

        for (const colName of collectionsToBackup) {
            const querySnapshot = await getDocs(collection(db, colName));
            allData[colName] = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }

        // 2. Prepare metadata
        const metadata = {
            total_users: allData['users']?.length || 0,
            total_tasks: allData['tasks']?.length || 0,
            backup_reason: 'auto-hourly',
            timestamp: backupTimestamp
        };

        // 3. Push to Supabase
        const { error } = await supabase
            .from('snapshot_backups')
            .insert({
                created_at: backupTimestamp,
                data: allData,
                metadata: metadata
            });

        if (error) {
            console.error('Supabase Backup Failed:', error);
            throw error;
        }

        console.log(`✅ Backup successful at ${backupTimestamp}`);
        return { success: true, timestamp: backupTimestamp };

    } catch (error) {
        console.error('Backup Service Error:', error);
        return { success: false, error };
    }
};

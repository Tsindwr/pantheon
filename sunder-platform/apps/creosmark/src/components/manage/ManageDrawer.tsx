import React from 'react';
import Sidebar from '../common/Sidebar';
import styles from './ManageDrawer.module.css';

type ManageDrawerProps = {
    open: boolean;
    onClose: () => void;
    onEnterEditMode: () => void;
    onReturnToPlay: () => void;
    isEditing: boolean;
};

export default function ManageDrawer({
    open,
    onClose,
    onEnterEditMode,
    onReturnToPlay,
    isEditing,
}: ManageDrawerProps) {
    return (
        <Sidebar open={open} onClose={onClose} title="Manage Character" width="320px">
            <div className={styles.group}>
                <div className={styles.groupLabel}>Views</div>

                <button
                    type={'button'}
                    className={`${styles.action} ${!isEditing ? styles.actionActive : ""}`}
                    onClick={() => {
                        onReturnToPlay();
                        onClose();
                    }}
                >
                    ▶ Play View
                </button>

                <button
                    type={'button'}
                    className={`${styles.action} ${isEditing ? styles.actionActive : ""}`}
                    onClick={() => {
                        onEnterEditMode();
                        onClose();
                    }}
                >
                    ✏️ Edit Character
                </button>
            </div>

            <div className={styles.group}>
                <div className={styles.groupLabel}>Later</div>

                <div className={styles.note}>
                    Save/load, export, import, and duplication can live here (prereq: Supabase)
                </div>
            </div>
        </Sidebar>
    );
}
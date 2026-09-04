import {useAppDispatch, useAppSelector} from '../../redux/hooks';
import useThemeColors from '../../hooks/useThemeColors';
import {fetchCategories, selectActiveCategories} from '../../redux/slice/categoryDataSlice';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {navigate} from '../../utils/navigationUtils';
import {softDeleteCategoryById} from '../../cloud';
import {useDialog} from '../../context/DialogContext';
import {useTranslation} from 'react-i18next';
import {selectUserId} from '../../redux/slice/userIdSlice';
import {requireCloudUser} from '../../cloud/records';

const useCategory = () => {
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const {showDialog, showAlert} = useDialog();
  const {t} = useTranslation();
  const categories = useAppSelector(selectActiveCategories);
  const [refreshing, setRefreshing] = useState(false);
  const userId = useAppSelector(selectUserId);
  const deletingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCategories());
    }, [dispatch]),
  );

  useEffect(() => {
    if (!refreshing) return;

    dispatch(fetchCategories()).finally(() => {
      setRefreshing(false);
    });
  }, [refreshing, dispatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const handleEdit = useCallback(
    (categoryId: string, categoryName: string, categoryIcon: string, categoryColor: string) => {
      navigate('UpdateCategoryScreen', {
        categoryId,
        categoryName,
        categoryIcon,
        categoryColor,
      });
    },
    [],
  );

  const handleDelete = useCallback(
    async (categoryId: string) => {
      if (deletingRef.current || !mountedRef.current) {
        return;
      }
      deletingRef.current = true;
      const capturedUserId = userId;
      try {
        requireCloudUser(capturedUserId);
        // Soft delete keeps historical expenses intact, but there is no in-app way
        // to bring a category back — so confirm before removing it.
        const confirmed = await showDialog({
          type: 'warning',
          message: t('category.deleteConfirm'),
        });
        if (!confirmed || !mountedRef.current) {
          return;
        }
        requireCloudUser(capturedUserId);
        await softDeleteCategoryById(categoryId);
        requireCloudUser(capturedUserId);
        if (!mountedRef.current) {
          return;
        }
        dispatch(fetchCategories());
      } catch (error) {
        if (__DEV__) {
          console.error('Error deleting category:', categoryId, error);
        }
        if (!mountedRef.current) {
          return;
        }
        try {
          requireCloudUser(capturedUserId);
        } catch {
          return;
        }
        await showAlert({
          type: 'error',
          message: 'Could not delete the category. Check your connection and try again.',
        });
      } finally {
        deletingRef.current = false;
      }
    },
    [dispatch, showDialog, showAlert, t, userId],
  );

  return {
    colors,
    refreshing,
    onRefresh,
    categories,
    handleEdit,
    handleDelete,
  };
};

export default useCategory;

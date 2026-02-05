package com.codesphere.backend.repository;

import com.codesphere.backend.entity.ExecutionEntity;
import com.codesphere.backend.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExecutionRepository extends JpaRepository<ExecutionEntity, Long> {

    List<ExecutionEntity> findByProjectIdOrderByExecutedAtDesc(Long projectId);

    void deleteByProject(ProjectEntity project);
}
